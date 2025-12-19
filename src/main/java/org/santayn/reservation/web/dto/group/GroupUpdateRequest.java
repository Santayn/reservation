package org.santayn.reservation.web.dto.group;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * Запрос на обновление группы.
 * facultyId опционален; если null, привязка будет снята.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GroupUpdateRequest(
        @NotBlank String name,
        @Min(0) Integer personsCount,
        Long facultyId
) {}
