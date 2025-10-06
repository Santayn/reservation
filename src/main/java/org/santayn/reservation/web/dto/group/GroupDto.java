package org.santayn.reservation.web.dto.group;

public record GroupDto(
        Long id,
        String name,
        Integer personsCount
) {}
