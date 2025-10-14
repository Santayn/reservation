package org.santayn.reservation.web.dto.group;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record GroupUpdateRequest(
        @NotBlank String name,
        String title,
        Integer courseCode,
        @Min(0) Integer size
) {}
