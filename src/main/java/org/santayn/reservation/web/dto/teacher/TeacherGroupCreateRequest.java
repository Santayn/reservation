// org/santayn/reservation/web/dto/teacher/TeacherGroupCreateRequest.java
package org.santayn.reservation.web.dto.teacher;
import jakarta.validation.constraints.*;
public record TeacherGroupCreateRequest(
        @NotNull Long teacherId,
        @NotNull Integer groupId
) {}
