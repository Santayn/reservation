// src/main/java/org/santayn/reservation/web/dto/classroom/ClassroomDto.java
package org.santayn.reservation.web.dto.classroom;

import java.util.List;

public record ClassroomDto(
        Long id,
        String name,
        Integer capacity,
        Long buildingId,
        List<Long> facultyIds,
        List<Long> specializationIds
) {}
