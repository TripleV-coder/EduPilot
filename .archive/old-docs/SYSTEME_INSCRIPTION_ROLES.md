# 🎭 Système d'Inscription et Attribution des Rôles - EduPilot

> **Comment gérer l'inscription des utilisateurs et l'attribution sécurisée des rôles dans un contexte scolaire multi-tenant**

---

## 🎯 Problématique

**Question clé:** Comment un utilisateur obtient-il son rôle lors de l'inscription ?

### ⚠️ Dangers à Éviter

```typescript
// ❌ DANGER - Ne JAMAIS faire ça !
export async function register(data: RegisterData) {
  const user = await prisma.user.create({
    data: {
      ...data,
      role: data.role, // ❌ L'utilisateur choisit son rôle = FAILLE !
    }
  });
}
```

**Problème:** Un attaquant pourrait s'inscrire comme `SUPER_ADMIN` !

---

## 🏗️ Architecture Proposée

### Principe Fondamental

> **"Personne ne choisit son propre rôle. Les rôles sont TOUJOURS attribués par une autorité supérieure."**

### Hiérarchie d'Attribution

```
SUPER_ADMIN (CLI/Script système)
  └─ Crée → SCHOOL_ADMIN
      └─ Crée → DIRECTOR, TEACHER, ACCOUNTANT, STUDENT, PARENT
          └─ TEACHER peut inviter → PARENT (via code)
```

---

## 📋 Flux d'Inscription Détaillés

### Flux 1: SUPER_ADMIN (Système)

**Contexte:** Création initiale du système

```typescript
// scripts/create-super-admin.ts (CLI uniquement)
import { Command } from 'commander';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

const program = new Command();

program
  .command('create-super-admin')
  .description('Create a super admin user')
  .requiredOption('-e, --email <email>', 'Email address')
  .requiredOption('-p, --password <password>', 'Password')
  .requiredOption('-f, --firstName <firstName>', 'First name')
  .requiredOption('-l, --lastName <lastName>', 'Last name')
  .action(async (options) => {
    // Vérifier que c'est bien un environnement autorisé
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️  Production mode - Confirmation required');
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        readline.question('Type "CREATE_SUPER_ADMIN" to confirm: ', resolve);
      });

      if (answer !== 'CREATE_SUPER_ADMIN') {
        console.log('❌ Operation cancelled');
        process.exit(1);
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(options.password, 12);

    // Create super admin
    const superAdmin = await prisma.user.create({
      data: {
        email: options.email,
        password: hashedPassword,
        firstName: options.firstName,
        lastName: options.lastName,
        role: 'SUPER_ADMIN',
        isActive: true,
        emailVerified: new Date(),
      },
    });

    // Log création
    await prisma.auditLog.create({
      data: {
        userId: superAdmin.id,
        action: 'SUPER_ADMIN_CREATED',
        targetType: 'user',
        targetId: superAdmin.id,
        metadata: {
          createdVia: 'CLI',
          environment: process.env.NODE_ENV,
        },
      },
    });

    console.log('✅ Super Admin created successfully');
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   ID: ${superAdmin.id}`);

    process.exit(0);
  });

program.parse();
```

**Usage:**
```bash
npm run create-super-admin -- \
  --email admin@edupilot.com \
  --password "SuperSecure123!" \
  --firstName "John" \
  --lastName "Doe"
```

**Sécurité:**
- ✅ Accessible uniquement via CLI (pas d'API)
- ✅ Confirmation en production
- ✅ Audit log systématique
- ✅ Pas d'interface web

---

### Flux 2: SCHOOL_ADMIN (Créé par SUPER_ADMIN)

**Contexte:** Nouveau établissement

#### Option A: Via Interface Admin

```typescript
// src/app/api/admin/schools/route.ts
import { requireSuperAdmin } from '@/lib/auth/guards';

export async function POST(req: Request) {
  // 1. Vérifier que l'utilisateur est SUPER_ADMIN
  const session = await auth();
  await requireSuperAdmin(session);

  const data = await req.json();

  // Validation
  const schema = z.object({
    // School data
    schoolName: z.string().min(3),
    schoolCode: z.string().min(3),
    schoolType: z.enum(['PUBLIC', 'PRIVATE', 'RELIGIOUS', 'INTERNATIONAL']),

    // Admin data
    adminEmail: z.string().email(),
    adminFirstName: z.string().min(2),
    adminLastName: z.string().min(2),
    adminPhone: z.string().optional(),
  });

  const validated = schema.parse(data);

  // 2. Créer l'établissement ET l'admin en transaction
  const result = await prisma.$transaction(async (tx) => {
    // Créer l'école
    const school = await tx.school.create({
      data: {
        name: validated.schoolName,
        code: validated.schoolCode,
        type: validated.schoolType,
        isActive: true,
      },
    });

    // Générer mot de passe temporaire
    const tempPassword = generateSecurePassword(); // "Abc123!@#"
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Créer l'admin
    const admin = await tx.user.create({
      data: {
        email: validated.adminEmail,
        password: hashedPassword,
        firstName: validated.adminFirstName,
        lastName: validated.adminLastName,
        phone: validated.adminPhone,
        role: 'SCHOOL_ADMIN', // ✅ Rôle attribué par SUPER_ADMIN
        schoolId: school.id,   // ✅ Lié à l'école
        isActive: true,
        mustChangePassword: true, // ✅ Force changement au 1er login
      },
    });

    // Créer token de premier login
    const token = await tx.passwordResetToken.create({
      data: {
        userId: admin.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    return { school, admin, tempPassword, token };
  });

  // 3. Envoyer email de bienvenue
  await sendEmail({
    to: validated.adminEmail,
    subject: 'Bienvenue sur EduPilot - Votre compte administrateur',
    template: 'welcome-school-admin',
    data: {
      firstName: validated.adminFirstName,
      schoolName: validated.schoolName,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/first-login?token=${result.token.token}`,
      tempPassword: result.tempPassword,
      supportEmail: 'support@edupilot.com',
    },
  });

  // 4. Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'SCHOOL_ADMIN_CREATED',
      targetType: 'user',
      targetId: result.admin.id,
      metadata: {
        schoolId: result.school.id,
        schoolName: result.school.name,
      },
    },
  });

  return NextResponse.json({
    success: true,
    school: result.school,
    admin: {
      id: result.admin.id,
      email: result.admin.email,
      firstName: result.admin.firstName,
      lastName: result.admin.lastName,
    },
  });
}
```

#### Email envoyé

```html
Bonjour {firstName},

Bienvenue sur EduPilot ! Vous avez été désigné(e) comme administrateur
de l'établissement "{schoolName}".

Votre compte a été créé avec succès :
- Email : {email}
- Mot de passe temporaire : {tempPassword}

🔒 Pour des raisons de sécurité, vous devrez changer ce mot de passe
lors de votre première connexion.

👉 Cliquez ici pour activer votre compte :
{loginUrl}

Ce lien expire dans 24 heures.

Besoin d'aide ? Contactez-nous à {supportEmail}

L'équipe EduPilot
```

---

### Flux 3: DIRECTOR, TEACHER, ACCOUNTANT (Créés par SCHOOL_ADMIN)

**Contexte:** Personnel de l'établissement

```typescript
// src/app/api/school/staff/route.ts
import { requireSchoolAdmin } from '@/lib/auth/guards';

export async function POST(req: Request) {
  const session = await auth();
  await requireSchoolAdmin(session);

  const data = await req.json();

  // Validation
  const schema = z.object({
    email: z.string().email(),
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    phone: z.string().optional(),
    role: z.enum(['DIRECTOR', 'TEACHER', 'ACCOUNTANT']), // ✅ Rôles autorisés

    // Pour TEACHER
    specialization: z.string().optional(),
    subjectIds: z.array(z.string()).optional(),

    // Pour DIRECTOR
    departmentId: z.string().optional(),
  });

  const validated = schema.parse(data);

  // Vérifier que l'email n'existe pas déjà
  const existing = await prisma.user.findUnique({
    where: { email: validated.email },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Un utilisateur avec cet email existe déjà' },
      { status: 400 }
    );
  }

  // Créer le compte
  const tempPassword = generateSecurePassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    // Créer l'utilisateur
    const user = await tx.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        firstName: validated.firstName,
        lastName: validated.lastName,
        phone: validated.phone,
        role: validated.role, // ✅ Rôle choisi par SCHOOL_ADMIN
        schoolId: session.user.schoolId!, // ✅ Auto-assigné à l'école
        isActive: true,
        mustChangePassword: true,
      },
    });

    // Créer profil spécifique selon le rôle
    if (validated.role === 'TEACHER') {
      await tx.teacherProfile.create({
        data: {
          userId: user.id,
          schoolId: session.user.schoolId!,
          employeeNumber: generateEmployeeNumber('T'),
          specialization: validated.specialization,
        },
      });

      // Assigner matières
      if (validated.subjectIds && validated.subjectIds.length > 0) {
        await tx.teacherSubject.createMany({
          data: validated.subjectIds.map(subjectId => ({
            teacherProfileId: user.id,
            subjectId,
          })),
        });
      }
    }

    // Token de premier login
    const token = await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
      },
    });

    return { user, tempPassword, token };
  });

  // Envoyer email
  await sendEmail({
    to: validated.email,
    subject: `Bienvenue à ${session.user.school.name} - Votre compte EduPilot`,
    template: 'welcome-staff',
    data: {
      firstName: validated.firstName,
      role: getRoleLabel(validated.role),
      schoolName: session.user.school.name,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/first-login?token=${result.token.token}`,
      tempPassword: result.tempPassword,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'STAFF_CREATED',
      targetType: 'user',
      targetId: result.user.id,
      metadata: {
        role: validated.role,
        schoolId: session.user.schoolId,
      },
    },
  });

  return NextResponse.json({
    success: true,
    user: {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
    },
  });
}
```

---

### Flux 4: STUDENT (Créé par SCHOOL_ADMIN/DIRECTOR)

**Contexte:** Inscription d'un élève

#### Option A: Inscription par l'établissement

```typescript
// src/app/api/school/students/route.ts

export async function POST(req: Request) {
  const session = await auth();
  await requireSchoolAdmin(session); // ou DIRECTOR

  const data = await req.json();

  const schema = z.object({
    // Student info
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    dateOfBirth: z.string().date(),
    gender: z.enum(['M', 'F']),

    // Parent info (optionnel au départ)
    parentEmail: z.string().email().optional(),
    parentFirstName: z.string().optional(),
    parentLastName: z.string().optional(),
    parentPhone: z.string().optional(),

    // Enrollment info
    classId: z.string(),
    academicYear: z.string(),
  });

  const validated = schema.parse(data);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Générer email et matricule
    const studentEmail = generateStudentEmail(
      validated.firstName,
      validated.lastName,
      validated.dateOfBirth
    ); // ex: "jean.dupont.2010@eleves.ecole.bj"

    const matricule = generateMatricule(session.user.schoolId!);

    // 2. Créer compte étudiant
    const tempPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await tx.user.create({
      data: {
        email: studentEmail,
        password: hashedPassword,
        firstName: validated.firstName,
        lastName: validated.lastName,
        role: 'STUDENT', // ✅ Rôle attribué automatiquement
        schoolId: session.user.schoolId!,
        isActive: true,
        mustChangePassword: true,
      },
    });

    // 3. Créer profil étudiant
    const studentProfile = await tx.studentProfile.create({
      data: {
        userId: user.id,
        schoolId: session.user.schoolId!,
        matricule,
        dateOfBirth: new Date(validated.dateOfBirth),
        gender: validated.gender,
      },
    });

    // 4. Inscrire dans la classe
    await tx.enrollment.create({
      data: {
        studentId: studentProfile.id,
        classId: validated.classId,
        academicYear: validated.academicYear,
        enrollmentDate: new Date(),
        status: 'ACTIVE',
      },
    });

    // 5. Si parent fourni, créer compte parent
    let parentUser = null;
    if (validated.parentEmail) {
      // Vérifier si parent existe déjà
      parentUser = await tx.user.findUnique({
        where: { email: validated.parentEmail },
      });

      if (!parentUser) {
        // Créer nouveau parent
        const parentPassword = generateSecurePassword();
        const hashedParentPassword = await bcrypt.hash(parentPassword, 12);

        parentUser = await tx.user.create({
          data: {
            email: validated.parentEmail,
            password: hashedParentPassword,
            firstName: validated.parentFirstName!,
            lastName: validated.parentLastName!,
            phone: validated.parentPhone,
            role: 'PARENT', // ✅ Rôle attribué automatiquement
            schoolId: session.user.schoolId!,
            isActive: true,
            mustChangePassword: true,
          },
        });

        // Créer profil parent
        const parentProfile = await tx.parentProfile.create({
          data: {
            userId: parentUser.id,
            schoolId: session.user.schoolId!,
          },
        });

        // Lier parent-enfant
        await tx.parentChild.create({
          data: {
            parentId: parentProfile.id,
            studentId: studentProfile.id,
            relationship: 'PARENT',
          },
        });
      } else {
        // Parent existe, juste créer relation
        const parentProfile = await tx.parentProfile.findUnique({
          where: { userId: parentUser.id },
        });

        await tx.parentChild.create({
          data: {
            parentId: parentProfile!.id,
            studentId: studentProfile.id,
            relationship: 'PARENT',
          },
        });
      }
    }

    return { user, studentProfile, parentUser, tempPassword };
  });

  // Envoyer emails
  // ... (similaire aux flux précédents)

  return NextResponse.json({
    success: true,
    student: {
      id: result.user.id,
      email: result.user.email,
      matricule: result.studentProfile.matricule,
    },
  });
}
```

#### Option B: Demande d'inscription par parent (portail public)

```typescript
// src/app/api/public/enrollment-request/route.ts

export async function POST(req: Request) {
  // ⚠️ Route PUBLIQUE - pas d'auth requise

  const data = await req.json();

  const schema = z.object({
    // Student info
    studentFirstName: z.string().min(2),
    studentLastName: z.string().min(2),
    studentDateOfBirth: z.string().date(),
    studentGender: z.enum(['M', 'F']),

    // Parent info
    parentFirstName: z.string().min(2),
    parentLastName: z.string().min(2),
    parentEmail: z.string().email(),
    parentPhone: z.string(),

    // School selection
    schoolId: z.string(),
    desiredClassLevel: z.string(),

    // Recaptcha
    recaptchaToken: z.string(),
  });

  const validated = schema.parse(data);

  // 1. Vérifier recaptcha
  const recaptchaValid = await verifyRecaptcha(validated.recaptchaToken);
  if (!recaptchaValid) {
    return NextResponse.json(
      { error: 'Validation reCAPTCHA échouée' },
      { status: 400 }
    );
  }

  // 2. Créer demande d'inscription (PAS de compte créé)
  const request = await prisma.enrollmentRequest.create({
    data: {
      schoolId: validated.schoolId,
      status: 'PENDING', // ✅ En attente de validation

      // Student data
      studentFirstName: validated.studentFirstName,
      studentLastName: validated.studentLastName,
      studentDateOfBirth: new Date(validated.studentDateOfBirth),
      studentGender: validated.studentGender,

      // Parent data
      parentFirstName: validated.parentFirstName,
      parentLastName: validated.parentLastName,
      parentEmail: validated.parentEmail,
      parentPhone: validated.parentPhone,

      desiredClassLevel: validated.desiredClassLevel,

      // Tracking
      requestDate: new Date(),
      ipAddress: getClientIP(req),
    },
  });

  // 3. Envoyer email de confirmation au parent
  await sendEmail({
    to: validated.parentEmail,
    subject: 'Demande d\'inscription reçue',
    template: 'enrollment-request-received',
    data: {
      parentFirstName: validated.parentFirstName,
      studentFirstName: validated.studentFirstName,
      requestNumber: request.id.slice(0, 8).toUpperCase(),
    },
  });

  // 4. Notifier l'école
  const schoolAdmins = await prisma.user.findMany({
    where: {
      schoolId: validated.schoolId,
      role: { in: ['SCHOOL_ADMIN', 'DIRECTOR'] },
      isActive: true,
    },
  });

  for (const admin of schoolAdmins) {
    await sendEmail({
      to: admin.email,
      subject: 'Nouvelle demande d\'inscription',
      template: 'enrollment-request-notification',
      data: {
        studentName: `${validated.studentFirstName} ${validated.studentLastName}`,
        parentName: `${validated.parentFirstName} ${validated.parentLastName}`,
        requestId: request.id,
        reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/school/enrollment-requests/${request.id}`,
      },
    });
  }

  return NextResponse.json({
    success: true,
    requestId: request.id,
    message: 'Votre demande a été envoyée. Vous recevrez une réponse sous 48-72h.',
  });
}
```

**Validation par l'école:**

```typescript
// src/app/api/school/enrollment-requests/[id]/approve/route.ts

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  await requireSchoolAdmin(session);

  const requestId = params.id;
  const data = await req.json();

  const schema = z.object({
    classId: z.string(),
    academicYear: z.string(),
    scholarshipAmount: z.number().optional(),
  });

  const validated = schema.parse(data);

  // Récupérer la demande
  const enrollmentRequest = await prisma.enrollmentRequest.findUnique({
    where: { id: requestId },
  });

  if (!enrollmentRequest || enrollmentRequest.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Demande introuvable ou déjà traitée' },
      { status: 404 }
    );
  }

  // ✅ MAINTENANT on crée les comptes (après validation humaine)
  const result = await prisma.$transaction(async (tx) => {
    // Créer étudiant
    const studentEmail = generateStudentEmail(
      enrollmentRequest.studentFirstName,
      enrollmentRequest.studentLastName,
      enrollmentRequest.studentDateOfBirth
    );

    const studentPassword = generateSecurePassword();
    const hashedStudentPassword = await bcrypt.hash(studentPassword, 12);

    const studentUser = await tx.user.create({
      data: {
        email: studentEmail,
        password: hashedStudentPassword,
        firstName: enrollmentRequest.studentFirstName,
        lastName: enrollmentRequest.studentLastName,
        role: 'STUDENT', // ✅ Rôle attribué par admin
        schoolId: session.user.schoolId!,
        isActive: true,
        mustChangePassword: true,
      },
    });

    const studentProfile = await tx.studentProfile.create({
      data: {
        userId: studentUser.id,
        schoolId: session.user.schoolId!,
        matricule: generateMatricule(session.user.schoolId!),
        dateOfBirth: enrollmentRequest.studentDateOfBirth,
        gender: enrollmentRequest.studentGender,
      },
    });

    // Créer parent
    const parentPassword = generateSecurePassword();
    const hashedParentPassword = await bcrypt.hash(parentPassword, 12);

    const parentUser = await tx.user.create({
      data: {
        email: enrollmentRequest.parentEmail,
        password: hashedParentPassword,
        firstName: enrollmentRequest.parentFirstName,
        lastName: enrollmentRequest.parentLastName,
        phone: enrollmentRequest.parentPhone,
        role: 'PARENT', // ✅ Rôle attribué par admin
        schoolId: session.user.schoolId!,
        isActive: true,
        mustChangePassword: true,
      },
    });

    const parentProfile = await tx.parentProfile.create({
      data: {
        userId: parentUser.id,
        schoolId: session.user.schoolId!,
      },
    });

    // Lier parent-enfant
    await tx.parentChild.create({
      data: {
        parentId: parentProfile.id,
        studentId: studentProfile.id,
        relationship: 'PARENT',
      },
    });

    // Inscrire dans classe
    await tx.enrollment.create({
      data: {
        studentId: studentProfile.id,
        classId: validated.classId,
        academicYear: validated.academicYear,
        enrollmentDate: new Date(),
        status: 'ACTIVE',
      },
    });

    // Mettre à jour la demande
    await tx.enrollmentRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedBy: session.user.id,
        approvedAt: new Date(),
        studentId: studentProfile.id,
      },
    });

    return { studentUser, parentUser, studentPassword, parentPassword };
  });

  // Envoyer emails avec identifiants
  await sendEmail({
    to: enrollmentRequest.parentEmail,
    subject: 'Inscription acceptée - Identifiants de connexion',
    template: 'enrollment-approved',
    data: {
      parentFirstName: enrollmentRequest.parentFirstName,
      studentFirstName: enrollmentRequest.studentFirstName,
      studentEmail: result.studentUser.email,
      studentPassword: result.studentPassword,
      parentEmail: result.parentUser.email,
      parentPassword: result.parentPassword,
      loginUrl: process.env.NEXT_PUBLIC_APP_URL,
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Inscription approuvée avec succès',
  });
}
```

---

### Flux 5: PARENT (Invitation par enseignant)

**Contexte:** Parent qui n'a pas encore de compte

```typescript
// src/app/api/teacher/invite-parent/route.ts

export async function POST(req: Request) {
  const session = await auth();

  // Vérifier que c'est un TEACHER
  if (session.user.role !== 'TEACHER') {
    return NextResponse.json(
      { error: 'Réservé aux enseignants' },
      { status: 403 }
    );
  }

  const data = await req.json();

  const schema = z.object({
    studentId: z.string(),
    parentEmail: z.string().email(),
    parentFirstName: z.string(),
    parentLastName: z.string(),
    parentPhone: z.string().optional(),
  });

  const validated = schema.parse(data);

  // 1. Vérifier que l'enseignant enseigne cet élève
  const teachesStudent = await prisma.enrollment.findFirst({
    where: {
      studentId: validated.studentId,
      class: {
        classSubjects: {
          some: {
            teacherProfileId: session.user.teacherProfile!.id,
          },
        },
      },
    },
  });

  if (!teachesStudent) {
    return NextResponse.json(
      { error: 'Vous n\'enseignez pas cet élève' },
      { status: 403 }
    );
  }

  // 2. Vérifier que le parent n'existe pas déjà
  const existing = await prisma.user.findUnique({
    where: { email: validated.parentEmail },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Un compte avec cet email existe déjà' },
      { status: 400 }
    );
  }

  // 3. Créer invitation (PAS de compte créé)
  const invitation = await prisma.parentInvitation.create({
    data: {
      studentId: validated.studentId,
      email: validated.parentEmail,
      firstName: validated.parentFirstName,
      lastName: validated.parentLastName,
      phone: validated.parentPhone,
      invitedBy: session.user.id,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
    },
  });

  // 4. Envoyer email d'invitation
  await sendEmail({
    to: validated.parentEmail,
    subject: 'Invitation à rejoindre EduPilot',
    template: 'parent-invitation',
    data: {
      parentFirstName: validated.parentFirstName,
      teacherName: `${session.user.firstName} ${session.user.lastName}`,
      studentName: '...', // Récupérer depuis DB
      schoolName: session.user.school.name,
      invitationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation?token=${invitation.token}`,
      expiresAt: invitation.expiresAt,
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Invitation envoyée',
  });
}

// Route d'acceptation d'invitation
// src/app/api/public/accept-parent-invitation/route.ts

export async function POST(req: Request) {
  const data = await req.json();

  const schema = z.object({
    token: z.string(),
    password: z.string().min(8),
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

  const validated = schema.parse(data);

  // 1. Trouver l'invitation
  const invitation = await prisma.parentInvitation.findUnique({
    where: { token: validated.token },
    include: {
      student: {
        include: {
          user: {
            select: { schoolId: true },
          },
        },
      },
    },
  });

  if (!invitation || invitation.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'Invitation invalide ou expirée' },
      { status: 400 }
    );
  }

  // 2. Créer le compte parent
  const hashedPassword = await bcrypt.hash(validated.password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const parentUser = await tx.user.create({
      data: {
        email: invitation.email,
        password: hashedPassword,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        phone: invitation.phone,
        role: 'PARENT', // ✅ Rôle attribué automatiquement
        schoolId: invitation.student.user.schoolId,
        isActive: true,
        emailVerified: new Date(), // Email déjà vérifié via invitation
      },
    });

    const parentProfile = await tx.parentProfile.create({
      data: {
        userId: parentUser.id,
        schoolId: invitation.student.user.schoolId,
      },
    });

    // Lier parent-enfant
    await tx.parentChild.create({
      data: {
        parentId: parentProfile.id,
        studentId: invitation.studentId,
        relationship: 'PARENT',
      },
    });

    // Marquer invitation comme utilisée
    await tx.parentInvitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    });

    return { parentUser };
  });

  return NextResponse.json({
    success: true,
    message: 'Compte créé avec succès',
    userId: result.parentUser.id,
  });
}
```

---

## 📊 Tableau Récapitulatif

| Rôle | Créé par | Méthode | Validation | Auto-activation |
|------|----------|---------|------------|-----------------|
| **SUPER_ADMIN** | Système | CLI script | Confirmation manuelle | ❌ Non (doit être activé) |
| **SCHOOL_ADMIN** | SUPER_ADMIN | Interface admin | Automatique | ✅ Oui (avec MDP temporaire) |
| **DIRECTOR** | SCHOOL_ADMIN | Interface école | Automatique | ✅ Oui (avec MDP temporaire) |
| **TEACHER** | SCHOOL_ADMIN | Interface école | Automatique | ✅ Oui (avec MDP temporaire) |
| **ACCOUNTANT** | SCHOOL_ADMIN | Interface école | Automatique | ✅ Oui (avec MDP temporaire) |
| **STUDENT** | SCHOOL_ADMIN/DIRECTOR | Interface école OU portail public | Automatique OU validation manuelle | ✅ Oui (avec MDP temporaire) |
| **PARENT** | SCHOOL_ADMIN/DIRECTOR OU invitation TEACHER | Interface école OU acceptation invitation | Automatique OU auto-inscription | ✅ Oui (MDP choisi ou temporaire) |

---

## 🔒 Principes de Sécurité Appliqués

### 1. **Principe du Moindre Privilège**
```typescript
// ❌ MAUVAIS
user.role = req.body.role; // L'utilisateur choisit son rôle

// ✅ BON
const role = getRoleBasedOnCreator(creator.role, requestedRole);
user.role = role;
```

### 2. **Validation par Autorité Supérieure**
```typescript
function canCreateRole(creatorRole: UserRole, targetRole: UserRole): boolean {
  const hierarchy = {
    SUPER_ADMIN: ['SCHOOL_ADMIN'],
    SCHOOL_ADMIN: ['DIRECTOR', 'TEACHER', 'ACCOUNTANT', 'STUDENT', 'PARENT'],
    DIRECTOR: ['STUDENT', 'PARENT'],
    TEACHER: ['PARENT'], // Via invitation uniquement
  };

  return hierarchy[creatorRole]?.includes(targetRole) || false;
}
```

### 3. **Audit Trail Complet**
```typescript
await prisma.auditLog.create({
  data: {
    userId: creatorId,
    action: 'USER_CREATED',
    targetType: 'user',
    targetId: newUserId,
    metadata: {
      createdRole: newUserRole,
      creatorRole: creatorRole,
      schoolId: schoolId,
      method: 'admin_interface', // ou 'cli', 'invitation', etc.
    },
  },
});
```

### 4. **Mot de Passe Temporaire + Force Changement**
```typescript
const user = await prisma.user.create({
  data: {
    // ...
    password: hashedTemporaryPassword,
    mustChangePassword: true, // ✅ Force changement au 1er login
    passwordChangedAt: null,
  },
});
```

### 5. **Isolation Multi-Tenant Stricte**
```typescript
// Le schoolId est TOUJOURS défini par le créateur
const newUser = await prisma.user.create({
  data: {
    // ...
    schoolId: creator.schoolId, // ✅ Jamais depuis req.body
  },
});
```

---

## 🎯 Schéma Prisma Complet

```prisma
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  password          String
  firstName         String
  lastName          String
  phone             String?
  role              UserRole
  schoolId          String?
  isActive          Boolean   @default(true)
  emailVerified     DateTime?
  mustChangePassword Boolean  @default(false)
  passwordChangedAt DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  school            School?   @relation(fields: [schoolId], references: [id])

  @@index([email])
  @@index([schoolId])
  @@index([role])
  @@map("users")
}

model EnrollmentRequest {
  id                  String   @id @default(cuid())
  schoolId            String
  status              EnrollmentRequestStatus @default(PENDING)

  // Student data
  studentFirstName    String
  studentLastName     String
  studentDateOfBirth  DateTime
  studentGender       Gender

  // Parent data
  parentFirstName     String
  parentLastName      String
  parentEmail         String
  parentPhone         String

  desiredClassLevel   String

  // Tracking
  requestDate         DateTime @default(now())
  ipAddress           String?
  approvedBy          String?
  approvedAt          DateTime?
  rejectedBy          String?
  rejectedAt          DateTime?
  rejectionReason     String?
  studentId           String?  // Rempli après création

  school              School   @relation(fields: [schoolId], references: [id])

  @@index([schoolId])
  @@index([status])
  @@index([parentEmail])
  @@map("enrollment_requests")
}

enum EnrollmentRequestStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}

model ParentInvitation {
  id          String   @id @default(cuid())
  studentId   String
  email       String
  firstName   String
  lastName    String
  phone       String?
  invitedBy   String
  token       String   @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  student     StudentProfile @relation(fields: [studentId], references: [id])
  invitedByUser User       @relation(fields: [invitedBy], references: [id])

  @@index([token])
  @@index([studentId])
  @@index([email])
  @@map("parent_invitations")
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@map("password_reset_tokens")
}
```

---

## ✅ Checklist de Sécurité

### Lors de la création d'un utilisateur:

- [ ] Le rôle est attribué par une autorité supérieure, JAMAIS par l'utilisateur lui-même
- [ ] Le schoolId est toujours hérité du créateur (sauf SUPER_ADMIN)
- [ ] Un mot de passe temporaire est généré et envoyé de manière sécurisée
- [ ] Le flag `mustChangePassword` est activé
- [ ] Un token de premier login est créé avec expiration
- [ ] Un audit log est créé avec tous les détails
- [ ] Un email de bienvenue est envoyé
- [ ] Les permissions sont vérifiées avant création
- [ ] Les données sont validées avec Zod
- [ ] La transaction est atomique (tout ou rien)

---

## 🚀 Conclusion

### Principe Fondamental

> **"Trust no one. Les utilisateurs ne choisissent JAMAIS leur propre rôle."**

### Les 3 Règles d'Or

1. **Hiérarchie Stricte**: Seul un rôle supérieur peut créer un rôle inférieur
2. **Validation Humaine**: Les demandes publiques nécessitent validation
3. **Audit Complet**: Chaque création est tracée avec contexte complet

### Avantages de ce Système

✅ **Sécurité**: Impossible de s'auto-attribuer un rôle élevé
✅ **Traçabilité**: On sait toujours qui a créé qui
✅ **Flexibilité**: 3 méthodes d'inscription selon le contexte
✅ **UX**: Processus fluide pour chaque type d'utilisateur
✅ **Conformité**: Respect RGPD avec validation des demandes

---

**Besoin d'implémenter un de ces flux ?** Je peux créer le code complet pour vous ! 🚀
