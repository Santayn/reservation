// src/main/java/org/santayn/reservation/web/dto/classroom/ClassroomCreateRequest.java
package org.santayn.reservation.web.dto.classroom;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record ClassroomCreateRequest(
        @NotBlank String name,
        @Min(0) Integer capacity,
        Long buildingId,
        List<Long> facultyIds,
        List<Long> specializationIds
) {}
