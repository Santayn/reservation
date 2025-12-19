// src/main/java/org/santayn/reservation/web/dto/classroom/ClassroomUpdateRequest.java
package org.santayn.reservation.web.dto.classroom;

import jakarta.validation.constraints.Min;
import java.util.List;

public record ClassroomUpdateRequest(
        @Min(0) Integer capacity,
        Long buildingId,
        List<Long> facultyIds,
        List<Long> specializationIds
) {}
