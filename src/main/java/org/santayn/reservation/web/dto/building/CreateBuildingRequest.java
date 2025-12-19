package org.santayn.reservation.web.dto.building;

import jakarta.validation.constraints.NotBlank;

/**
 * Запрос на создание корпуса.
 */
public record CreateBuildingRequest(
        @NotBlank String name
) { }
