// org/santayn/reservation/web/dto/teacher/TeacherGroupCreateRequest.java
package org.santayn.reservation.web.dto.teacher;

import jakarta.validation.constraints.NotNull;

public record TeacherGroupCreateRequest(
        @NotNull Long teacherId,   // ID пользователя-преподавателя (User.id = Long)
        @NotNull Integer groupId   // ID группы (Group.id = Integer)
) {}
