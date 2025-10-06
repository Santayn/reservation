package org.santayn.reservation.web.dto.group;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * Запрос на создание группы.
 * Поддерживает опциональный facultyId, который при наличии
 * привяжет группу к факультету через таблицу group_faculty.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GroupCreateRequest(
        @NotBlank String name,
        @Min(0) Integer personsCount,
        Long facultyId
) {}
