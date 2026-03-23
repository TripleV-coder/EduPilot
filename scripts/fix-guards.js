const fs = require('fs');
const path = require('path');
const glob = require('glob'); // Not available? We can just use a recursive walk.

const walkSync = (dir, filelist = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    const dirent = fs.statSync(dirFile);
    if (dirent.isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.tsx')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
};

const directory = '/home/triple-v/Documents/Projets Personnels/edupilot-master/src/app/(dashboard)/dashboard';
const files = walkSync(directory);

const rolesMap = {
  // Principal
  'performances': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]',

  // Académique
  'grades': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'schedule': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'attendance': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]',
  'library': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'resources': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT"]',
  'gamification': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'courses': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]', // Assume same as classes

  // Gestion
  'users': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'classes': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]',
  'students': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "PARENT", "STUDENT"]',
  'teachers': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'parents': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'documents': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'schools': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]', // Custom map

  // Vie Scolaire
  'medical': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'incidents': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]',
  'orientation': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STUDENT"]',
  'canteen': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT", "STUDENT"]',

  // Communication
  'ai': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'messages': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'announcements': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'events': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'appointments': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT"]',
  'notifications': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'notifications/sms': '["SUPER_ADMIN", "SCHOOL_ADMIN"]',

  // Administration
  'finance': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]',
  'scholarships': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"]',
  'system': '["SUPER_ADMIN"]',
  'compliance': '["SUPER_ADMIN", "SCHOOL_ADMIN"]',
  'root-control': '["SUPER_ADMIN"]',
  'audit-logs': '["SUPER_ADMIN", "SCHOOL_ADMIN"]',
  
  // Others based on paths
  'admin': '["SUPER_ADMIN"]',
  'exams': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]', // Under grades concept?
  'homework': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'calendar': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'import': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]', // usually
  'analytics': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]', // general analytics
};

const validPermissions = new Set([
  // School Management
  "SCHOOL_CREATE", "SCHOOL_READ", "SCHOOL_UPDATE", "SCHOOL_DELETE",
  // User Management
  "USER_CREATE", "USER_READ", "USER_UPDATE", "USER_DELETE",
  // Student Management
  "STUDENT_CREATE", "STUDENT_READ", "STUDENT_UPDATE", "STUDENT_DELETE", "STUDENT_READ_OWN",
  // Teacher Management
  "TEACHER_CREATE", "TEACHER_READ", "TEACHER_UPDATE", "TEACHER_DELETE",
  // Class Management
  "CLASS_CREATE", "CLASS_READ", "CLASS_UPDATE", "CLASS_DELETE",
  // Subject Management
  "SUBJECT_CREATE", "SUBJECT_READ", "SUBJECT_UPDATE", "SUBJECT_DELETE",
  // Grade Management
  "GRADE_CREATE", "GRADE_READ", "GRADE_UPDATE", "GRADE_DELETE", "GRADE_READ_OWN", "GRADE_READ_CHILDREN",
  // Evaluation Management
  "EVALUATION_CREATE", "EVALUATION_READ", "EVALUATION_UPDATE", "EVALUATION_DELETE",
  // Schedule Management
  "SCHEDULE_CREATE", "SCHEDULE_READ", "SCHEDULE_UPDATE", "SCHEDULE_DELETE",
  // Finance Management
  "FEE_CREATE", "FEE_READ", "FEE_UPDATE", "FEE_DELETE",
  "FINANCE_CREATE", "FINANCE_READ", "FINANCE_UPDATE", "FINANCE_DELETE",
  "PAYMENT_CREATE", "PAYMENT_READ", "PAYMENT_UPDATE", "PAYMENT_DELETE", "PAYMENT_READ_OWN",
  // Reports & Statistics
  "REPORT_VIEW", "STATISTICS_VIEW",
  // Notifications
  "NOTIFICATION_CREATE", "NOTIFICATION_READ", "NOTIFICATION_DELETE",
  // Academic Year Management
  "ACADEMIC_YEAR_CREATE", "ACADEMIC_YEAR_READ", "ACADEMIC_YEAR_UPDATE", "ACADEMIC_YEAR_DELETE",
  // Calendar Management
  "CALENDAR_EVENT_CREATE", "CALENDAR_EVENT_READ", "CALENDAR_EVENT_UPDATE", "CALENDAR_EVENT_DELETE",
  "HOLIDAY_CREATE", "HOLIDAY_READ", "HOLIDAY_UPDATE", "HOLIDAY_DELETE",
  // Orientation Management
  "ORIENTATION_CREATE", "ORIENTATION_READ", "ORIENTATION_UPDATE", "ORIENTATION_DELETE", "ORIENTATION_READ_OWN", "ORIENTATION_READ_CHILDREN", "ORIENTATION_VALIDATE",
  // Analytics Management
  "ANALYTICS_VIEW", "ANALYTICS_VIEW_OWN", "ANALYTICS_VIEW_CHILDREN", "ANALYTICS_GENERATE",
  // AI Predictions
  "AI_PREDICT_STUDENT", "AI_PREDICT_CLASS", "AI_PREDICT_VIEW_OWN", "AI_PREDICT_VIEW_CHILDREN",
  // System Management
  "SYSTEM_BACKUP_CREATE", "SYSTEM_BACKUP_VIEW", "SYSTEM_BACKUP_RESTORE", "SYSTEM_READ", "SYSTEM_WRITE"
]);

// Helper to determine module from path
function getModuleFromPath(filePath) {
  const relativePath = filePath.replace(directory, '');
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length > 0) {
    if (parts[0] === 'notifications' && parts[1] === 'sms') return 'notifications/sms';
    return parts[0]; // e.g. 'grades', 'attendance', 'users'
  }
  return '';
}

// Regex to find `<PageGuard ... >`
const pageGuardRegex = /<PageGuard\s([^>]*?)>/g;

let changes = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  const mod = getModuleFromPath(file);
  
  // By default, if we are in settings, we might leave roles alone or let everyone in, but let's apply the roles Map if available
  // Wait, let's keep Settings as it is or allow everyone?
  let moduleRoles = rolesMap[mod];
  if (!moduleRoles) {
    // If no roles specified for the module, skip injecting roles unless it's a specific route
    if (mod === 'settings') {
      // allow some standard ones
    }
  }

  const originalContent = content;

  content = content.replace(pageGuardRegex, (match, propsString) => {
    let newPropsString = propsString;

    // 1. Check and fix permission prop
    // Extract single permission: permission={Permission.XXXX}
    const singlePermMatch = newPropsString.match(/permission=\{Permission\.([A_Z_]+)\}/);
    if (singlePermMatch) {
      const perm = singlePermMatch[1];
      if (!validPermissions.has(perm)) {
        console.log(`Fixing invalid permission ${perm} in ${file}`);
        newPropsString = newPropsString.replace(/permission=\{Permission\.[A_Z_]+\}/, `permission={Permission.SCHOOL_READ}`);
      }
    }
    
    // Extract array permission: permission={[Permission.XXXX, Permission.YYYY]}
    const arrayPermMatch = newPropsString.match(/permission=\{\[([^\]]+)\]\}/);
    if (arrayPermMatch) {
      const permsContent = arrayPermMatch[1];
      const fixedPerms = permsContent.replace(/Permission\.([A_Z_]+)/g, (pMatch, pEnum) => {
        if (!validPermissions.has(pEnum)) {
          return 'Permission.SCHOOL_READ';
        }
        return pMatch;
      });
      newPropsString = newPropsString.replace(/permission=\{\[[^\]]+\]\}/, `permission={[${fixedPerms}]}`);
    }

    // Replace "*" as Permission to remove it or change to SCHOOL_READ or something?
    // User requested: "If it doesn't exist, remove the permission prop and just rely on roles={...}, or change it to a generic Permission.SCHOOL_READ"
    if (newPropsString.includes('"*" as Permission') || newPropsString.includes("' * ' as Permission") || newPropsString.includes("'*' as Permission")) {
        // Let's just remove permission prop entirely for "*"
        newPropsString = newPropsString.replace(/permission=\{["']\*["'] as Permission\}\s*(\/\*.*?\*\/)?/, '');
    }
    
    // Clean up empty permission arrays if any
    newPropsString = newPropsString.replace(/permission=\{\s*\[\s*\]\s*\}/, '');

    // 2. Fix roles
    // If we have a module mapping for roles, enforce it
    if (moduleRoles) {
      // remove existing roles
      newPropsString = newPropsString.replace(/roles=\{[^}]+\}/, '');
      newPropsString = newPropsString.replace(/roles=\{.*?\}(?=\s|\/|>)/, ''); // More robust removal if spread over multiple lines (though usually one line)
      
      // Also remove any remaining `roles={...}` that might use `ADMIN_ROLES` etc.
      newPropsString = newPropsString.replace(/roles=\{[^}]+\}/g, '');
      
      // Append new roles
      newPropsString = `${newPropsString.trim()} roles={${moduleRoles}}`.trim();
    }

    return `<PageGuard ${newPropsString}>`.replace(/\s+/g, ' ').replace(' >', '>');
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf-8');
    changes++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Total files modified: ${changes}`);
