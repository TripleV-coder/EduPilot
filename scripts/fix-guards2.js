const fs = require('fs');
const path = require('path');

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
  'performances': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]',
  'grades': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'schedule': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'attendance': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]',
  'library': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'resources': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT"]',
  'gamification': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'courses': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]',
  'users': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'classes': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]',
  'students': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "PARENT", "STUDENT"]',
  'teachers': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'parents': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'documents': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'schools': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'medical': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'incidents': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]',
  'orientation': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STUDENT"]',
  'canteen': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT", "STUDENT"]',
  'ai': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'messages': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'announcements': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'events': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'appointments': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT"]',
  'notifications': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'notifications/sms': '["SUPER_ADMIN", "SCHOOL_ADMIN"]',
  'finance': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]',
  'scholarships': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"]',
  'system': '["SUPER_ADMIN"]',
  'compliance': '["SUPER_ADMIN", "SCHOOL_ADMIN"]',
  'root-control': '["SUPER_ADMIN"]',
  'audit-logs': '["SUPER_ADMIN", "SCHOOL_ADMIN"]',
  'admin': '["SUPER_ADMIN"]',
  'exams': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'homework': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'calendar': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]',
  'import': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]',
  'analytics': '["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]',
};

const validPermissions = new Set([
  "SCHOOL_CREATE", "SCHOOL_READ", "SCHOOL_UPDATE", "SCHOOL_DELETE",
  "USER_CREATE", "USER_READ", "USER_UPDATE", "USER_DELETE",
  "STUDENT_CREATE", "STUDENT_READ", "STUDENT_UPDATE", "STUDENT_DELETE", "STUDENT_READ_OWN",
  "TEACHER_CREATE", "TEACHER_READ", "TEACHER_UPDATE", "TEACHER_DELETE",
  "CLASS_CREATE", "CLASS_READ", "CLASS_UPDATE", "CLASS_DELETE",
  "SUBJECT_CREATE", "SUBJECT_READ", "SUBJECT_UPDATE", "SUBJECT_DELETE",
  "GRADE_CREATE", "GRADE_READ", "GRADE_UPDATE", "GRADE_DELETE", "GRADE_READ_OWN", "GRADE_READ_CHILDREN",
  "EVALUATION_CREATE", "EVALUATION_READ", "EVALUATION_UPDATE", "EVALUATION_DELETE",
  "SCHEDULE_CREATE", "SCHEDULE_READ", "SCHEDULE_UPDATE", "SCHEDULE_DELETE",
  "FEE_CREATE", "FEE_READ", "FEE_UPDATE", "FEE_DELETE",
  "FINANCE_CREATE", "FINANCE_READ", "FINANCE_UPDATE", "FINANCE_DELETE",
  "PAYMENT_CREATE", "PAYMENT_READ", "PAYMENT_UPDATE", "PAYMENT_DELETE", "PAYMENT_READ_OWN",
  "REPORT_VIEW", "STATISTICS_VIEW",
  "NOTIFICATION_CREATE", "NOTIFICATION_READ", "NOTIFICATION_DELETE",
  "ACADEMIC_YEAR_CREATE", "ACADEMIC_YEAR_READ", "ACADEMIC_YEAR_UPDATE", "ACADEMIC_YEAR_DELETE",
  "CALENDAR_EVENT_CREATE", "CALENDAR_EVENT_READ", "CALENDAR_EVENT_UPDATE", "CALENDAR_EVENT_DELETE",
  "HOLIDAY_CREATE", "HOLIDAY_READ", "HOLIDAY_UPDATE", "HOLIDAY_DELETE",
  "ORIENTATION_CREATE", "ORIENTATION_READ", "ORIENTATION_UPDATE", "ORIENTATION_DELETE", "ORIENTATION_READ_OWN", "ORIENTATION_READ_CHILDREN", "ORIENTATION_VALIDATE",
  "ANALYTICS_VIEW", "ANALYTICS_VIEW_OWN", "ANALYTICS_VIEW_CHILDREN", "ANALYTICS_GENERATE",
  "AI_PREDICT_STUDENT", "AI_PREDICT_CLASS", "AI_PREDICT_VIEW_OWN", "AI_PREDICT_VIEW_CHILDREN",
  "SYSTEM_BACKUP_CREATE", "SYSTEM_BACKUP_VIEW", "SYSTEM_BACKUP_RESTORE", "SYSTEM_READ", "SYSTEM_WRITE"
]);

function getModuleFromPath(filePath) {
  const relativePath = filePath.replace(directory, '');
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length > 0) {
    if (parts[0] === 'notifications' && parts[1] === 'sms') return 'notifications/sms';
    return parts[0];
  }
  return '';
}

const pageGuardRegex = /<PageGuard\s([^>]*?)>/g;
let changes = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  const mod = getModuleFromPath(file);
  let moduleRoles = rolesMap[mod];

  const originalContent = content;

  content = content.replace(pageGuardRegex, (match, propsString) => {
    let newPropsString = propsString;

    // Fix single permission
    const singlePermMatch = newPropsString.match(/permission=\{Permission\.([A-Z_]+)\}/);
    if (singlePermMatch) {
      const perm = singlePermMatch[1];
      if (!validPermissions.has(perm)) {
        console.log(`Fixing single invalid permission ${perm} in ${file}`);
        newPropsString = newPropsString.replace(new RegExp(`permission=\\{Permission\\.${perm}\\}`), `permission={Permission.SCHOOL_READ}`);
      }
    }
    
    // Fix array permissions
    const arrayPermMatch = newPropsString.match(/permission=\{\[([^\]]+)\]\}/);
    if (arrayPermMatch) {
      const permsContent = arrayPermMatch[1];
      const fixedPerms = permsContent.replace(/Permission\.([A-Z_]+)/g, (pMatch, pEnum) => {
        if (!validPermissions.has(pEnum)) {
          console.log(`Fixing array invalid permission ${pEnum} in ${file}`);
          return 'Permission.SCHOOL_READ';
        }
        return pMatch;
      });
      newPropsString = newPropsString.replace(/permission=\{\[[^\]]+\]\}/, `permission={[${fixedPerms}]}`);
    }

    if (newPropsString.includes('"*" as Permission') || newPropsString.includes("' * ' as Permission") || newPropsString.includes("'*' as Permission")) {
        newPropsString = newPropsString.replace(/permission=\{["']\*["'] as Permission\}\s*(\/\*.*?\*\/)?/, '');
    }
    
    newPropsString = newPropsString.replace(/permission=\{\s*\[\s*\]\s*\}/, '');

    if (moduleRoles) {
      newPropsString = newPropsString.replace(/roles=\{[^}]+\}/g, '');
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
