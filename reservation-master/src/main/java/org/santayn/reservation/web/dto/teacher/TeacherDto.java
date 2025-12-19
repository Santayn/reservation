// org/santayn/reservation/web/dto/teacher/TeacherDto.java
package org.santayn.reservation.web.dto.teacher;

public record TeacherDto(
        Long id,
        String fullName,
        String login,
        Long facultyId
) {}
