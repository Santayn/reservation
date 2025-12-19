package org.santayn.reservation.web.dto.teacher;

/**
 * Короткое представление преподавателя.
 * Поля fullName в нашей модели User нет — используем login.
 */
public record TeacherDto(
        Long id,
        String login,
        Long facultyId
) {}
