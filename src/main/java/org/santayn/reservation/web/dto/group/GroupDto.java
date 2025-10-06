package org.santayn.reservation.web.dto.group;

/** Короткое представление группы под нашу модель (без title/courseCode). */
public record GroupDto(
        Long id,
        String name,
        Integer personsCount,
        Long facultyId // если у группы есть связь — возвращаем первый facultyId, иначе null
) {}
