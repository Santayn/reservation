package org.santayn.reservation.web.dto.group;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Обновление группы. Если указан facultyId — гарантируем наличие связи group↔faculty. */
public record GroupUpdateRequest(
        @NotBlank String name,
        @NotNull @Min(1) Integer personsCount,
        Long facultyId
) {}
