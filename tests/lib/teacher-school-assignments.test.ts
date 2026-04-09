import {
  buildTeacherSchoolAssignments,
  normalizeTeacherSchoolIds,
} from "@/lib/teachers/school-assignments";

describe("teacher school assignments helpers", () => {
  it("normalizes the primary and additional school ids without duplicates", () => {
    const result = normalizeTeacherSchoolIds({
      primarySchoolId: "school-a",
      additionalSchoolIds: ["school-b", "school-a", "school-c"],
    });

    expect(result.primarySchoolId).toBe("school-a");
    expect(result.schoolIds).toEqual(["school-a", "school-b", "school-c"]);
    expect(result.additionalSchoolIds).toEqual(["school-b", "school-c"]);
  });

  it("builds assignment rows with the primary flag", () => {
    const assignments = buildTeacherSchoolAssignments({
      teacherId: "teacher-1",
      userId: "user-1",
      primarySchoolId: "school-a",
      schoolIds: ["school-a", "school-b"],
    });

    expect(assignments).toEqual([
      {
        teacherId: "teacher-1",
        userId: "user-1",
        schoolId: "school-a",
        status: "ACTIVE",
        isPrimary: true,
      },
      {
        teacherId: "teacher-1",
        userId: "user-1",
        schoolId: "school-b",
        status: "ACTIVE",
        isPrimary: false,
      },
    ]);
  });
});
