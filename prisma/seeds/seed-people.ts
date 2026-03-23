/**
 * Seed People — Teachers, Class-Subject assignments, Families
 * Sections 9-11 of the original seed.ts
 */

import {
    prisma,
    SeedContext,
    createUser,
    generateMatricule,
    randomDate,
    randomElement,
    randomInt,
    firstNamesMale,
    firstNamesFemale,
    lastNames,
    nationalities,
    cities,
    professions,
    studentScenarios,
} from "./utils";

/**
 * Seed teachers, class-subject assignments, parents, and students
 */
export async function seedPeople(ctx: SeedContext): Promise<void> {
    // 9. Teachers
    console.log("👨‍🏫 Création des enseignants...\n");

    const teachersData = [
        { firstName: "Marie-Claire", lastName: "Agbossou", subject: "Français", email: "m.agbossou" },
        { firstName: "Pierre", lastName: "Hounkpatin", subject: "Mathématiques", email: "p.hounkpatin" },
        { firstName: "Fatou", lastName: "Bello", subject: "Physique-Chimie", email: "f.bello" },
        { firstName: "Jean-Baptiste", lastName: "Dossou", subject: "Sciences de la Vie et de la Terre", email: "jb.dossou" },
        { firstName: "Aicha", lastName: "Togan", subject: "Anglais", email: "a.togan" },
        { firstName: "Christian", lastName: "Chabi", subject: "Histoire-Géographie", email: "c.chabi" },
        { firstName: "Claire", lastName: "Ahounou", subject: "Philosophie", email: "c.ahounou" },
        { firstName: "David", lastName: "Zinsou", subject: "Éducation Physique et Sportive", email: "d.zinsou" },
        { firstName: "Emmanuel", lastName: "Gandonou", subject: "Informatique", email: "e.gandonou" },
        { firstName: "Grâce", lastName: "Sossou", subject: "Arts Plastiques", email: "g.sossou" },
        { firstName: "Henri", lastName: "Kounou", subject: "Éducation Civique et Morale", email: "h.kounou" },
        { firstName: "Irène", lastName: "Gbèdji", subject: "Français", email: "i.gbedji" },
    ];

    for (let i = 0; i < teachersData.length; i++) {
        const t = teachersData[i];
        const user = await createUser(`${t.email}@saintmichel.bj`, t.firstName, t.lastName, "TEACHER", ctx.school1.id);
        const profile = await prisma.teacherProfile.create({
            data: {
                userId: user.id,
                schoolId: ctx.school1.id,
                matricule: generateMatricule("ENS", i),
                specialization: t.subject,
                hireDate: randomDate(new Date(2015, 8, 1), new Date(2023, 8, 1)),
            },
        });
        ctx.teachers.push({ user, profile, data: t });
    }
    console.log(`   ✅ ${ctx.teachers.length} enseignants créés\n`);

    // 10. Class-Subject assignments
    console.log("📎 Affectation des matières aux classes...\n");

    for (const cls of ctx.collegeClasses) {
        for (let i = 0; i < ctx.subjects.length; i++) {
            const subject = ctx.subjects[i];
            const subjectData = ctx.subjectsData[i];

            if (subject.code === "PHILO" && (cls.levelName === "6ème" || cls.levelName === "5ème")) continue;

            const teacher = ctx.teachers.find((t: any) => t.data.subject === subject.name);
            if (teacher) {
                const cs = await prisma.classSubject.create({
                    data: {
                        classId: cls.id,
                        subjectId: subject.id,
                        teacherId: teacher.profile.id,
                        coefficient: subjectData.coef,
                        weeklyHours: subject.code === "MATH" || subject.code === "FR" ? 5 : 3,
                    },
                });
                ctx.classSubjects.push({ ...cs, class: cls, subject, teacher });
            }
        }
    }

    for (let i = 0; i < ctx.collegeClasses.length && i < ctx.teachers.length; i++) {
        await prisma.class.update({
            where: { id: ctx.collegeClasses[i].id },
            data: { mainTeacherId: ctx.teachers[i].profile.id },
        });
    }
    console.log(`   ✅ ${ctx.classSubjects.length} affectations matières/classes créées\n`);

    // 11. Parents and Students
    console.log("👨‍👩‍👧‍👦 Création des familles (parents et élèves)...\n");

    let studentIndex = 0;
    let scenarioIndex = 0;
    let currentScenarioCount = 0;

    for (const assignedClass of ctx.collegeClasses) {
        const studentCountForClass = randomInt(30, 40);

        for (let i = 0; i < studentCountForClass; i++) {
            if (currentScenarioCount >= studentScenarios[scenarioIndex].count) {
                scenarioIndex = (scenarioIndex + 1) % studentScenarios.length;
                currentScenarioCount = 0;
            }
            const scenario = studentScenarios[scenarioIndex];
            currentScenarioCount++;

            const familyLastName = randomElement(lastNames);

            // Create Father
            const fatherFirstName = randomElement(firstNamesMale);
            const fatherUser = await createUser(
                `${fatherFirstName.toLowerCase()}.${familyLastName.toLowerCase()}${studentIndex}@gmail.com`,
                fatherFirstName, familyLastName, "PARENT", ctx.school1.id
            );
            const fatherProfile = await prisma.parentProfile.create({
                data: { userId: fatherUser.id, profession: randomElement(professions) },
            });
            ctx.parents.push({ user: fatherUser, profile: fatherProfile, relationship: "Père" });

            // Create Mother (70%)
            let motherProfile = null;
            if (Math.random() < 0.7) {
                const motherFirstName = randomElement(firstNamesFemale);
                const motherUser = await createUser(
                    `${motherFirstName.toLowerCase()}.${familyLastName.toLowerCase()}${studentIndex}m@gmail.com`,
                    motherFirstName, familyLastName, "PARENT", ctx.school1.id
                );
                motherProfile = await prisma.parentProfile.create({
                    data: { userId: motherUser.id, profession: randomElement(professions) },
                });
                ctx.parents.push({ user: motherUser, profile: motherProfile, relationship: "Mère" });
            }

            // Create Student
            const gender = randomElement(["MALE", "FEMALE"]);
            const studentFirstName = gender === "MALE" ? randomElement(firstNamesMale) : randomElement(firstNamesFemale);

            const studentUser = await createUser(
                `${studentFirstName.toLowerCase()}.${familyLastName.toLowerCase()}${studentIndex}@eleve.saintmichel.bj`,
                studentFirstName, familyLastName, "STUDENT", ctx.school1.id
            );

            // Calculate Birth Year based on level sequence (1 to 7)
            // 6e (sequence 1) -> approx 11-12 years old in 2024 -> ~2012
            const levelSeq = assignedClass.level.sequence || 1;
            const birthYear = 2024 - (11 + levelSeq);

            const studentProfile = await prisma.studentProfile.create({
                data: {
                    userId: studentUser.id,
                    schoolId: ctx.school1.id,
                    matricule: generateMatricule("ELV", studentIndex),
                    dateOfBirth: randomDate(new Date(birthYear, 0, 1), new Date(birthYear, 11, 31)),
                    gender: gender as any,
                    birthPlace: randomElement(cities),
                    nationality: randomElement(nationalities),
                    address: `Quartier ${randomElement(["Akpakpa", "Cadjèhoun", "Fidjrossè", "Gbégamey", "Kouhounou", "Mènontin", "Zogbo"])}, Cotonou`,
                },
            });

            await prisma.enrollment.create({
                data: { studentId: studentProfile.id, classId: assignedClass.id, academicYearId: ctx.academicYear1.id, status: "ACTIVE" },
            });

            await prisma.parentStudent.create({
                data: { parentId: fatherProfile.id, studentId: studentProfile.id, relationship: "Père", isPrimary: true },
            });

            if (motherProfile) {
                await prisma.parentStudent.create({
                    data: { parentId: motherProfile.id, studentId: studentProfile.id, relationship: "Mère", isPrimary: false },
                });
            }

            ctx.students.push({
                user: studentUser,
                profile: studentProfile,
                class: assignedClass,
                scenario,
                parents: motherProfile ? [fatherProfile, motherProfile] : [fatherProfile],
            });
            studentIndex++;
        }
    }

    console.log(`   ✅ ${ctx.parents.length} parents et ${ctx.students.length} élèves créés\n`);
}
