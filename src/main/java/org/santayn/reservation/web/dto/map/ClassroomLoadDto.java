package org.santayn.reservation.web.dto.map;

public record ClassroomLoadDto(
        Long classroomId,
        String classroomName,
        Integer capacity,
        Integer load,
        double utilization,
        String badgeClass
) {}
