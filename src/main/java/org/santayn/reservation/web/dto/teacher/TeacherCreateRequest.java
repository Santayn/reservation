// org/santayn/reservation/web/dto/teacher/TeacherCreateRequest.java
package org.santayn.reservation.web.dto.teacher;
import jakarta.validation.constraints.*;
public record TeacherCreateRequest(
        @NotBlank String fullName,
        @NotBlank String login,
        @NotBlank String passwordHash,
        @NotNull Long facultyId
) {}
