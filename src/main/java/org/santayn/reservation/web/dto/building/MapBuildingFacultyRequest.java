package org.santayn.reservation.web.dto.building;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Запрос на создание связи корпус↔факультет.
 */
public record MapBuildingFacultyRequest(
        @NotNull @Min(1) Long buildingId,
        @NotNull @Min(1) Long facultyId
) { }
