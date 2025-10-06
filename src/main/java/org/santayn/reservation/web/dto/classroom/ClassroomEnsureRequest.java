// src/main/java/org/santayn/reservation/web/dto/classroom/ClassroomEnsureRequest.java
package org.santayn.reservation.web.dto.classroom;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record ClassroomEnsureRequest(
        @NotBlank String name,
        @Min(0) Integer capacity
) {}
