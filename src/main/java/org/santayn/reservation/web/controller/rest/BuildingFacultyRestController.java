package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.BuildingFacultyService;
import org.santayn.reservation.web.dto.building.BuildingDto;
import org.santayn.reservation.web.dto.building.MapBuildingFacultyRequest;
import org.santayn.reservation.web.dto.faculty.FacultyDto;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Привязка факультетов к корпусам.
 *
 * POST    /api/building-faculties                 — создать связь {buildingId, facultyId}
 * DELETE  /api/building-faculties?buildingId=&facultyId= — удалить связь
 * GET     /api/building-faculties/{buildingId}    — список факультетов корпуса
 * GET     /api/faculty-buildings/{facultyId}      — список корпусов факультета
 */
@RestController
@RequiredArgsConstructor
@Validated
public class BuildingFacultyRestController {

    private final BuildingFacultyService service;

    @PostMapping("/api/building-faculties")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void map(@Valid @RequestBody MapBuildingFacultyRequest req) {
        service.map(req.buildingId(), req.facultyId());
    }

    @DeleteMapping("/api/building-faculties")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void unmap(
            @RequestParam @Min(1) Long buildingId,
            @RequestParam @Min(1) Long facultyId
    ) {
        service.unmap(buildingId, facultyId);
    }

    @GetMapping("/api/building-faculties/{buildingId}")
    public List<FacultyDto> listFaculties(@PathVariable @Min(1) Long buildingId) {
        return service.listFacultiesByBuilding(buildingId);
    }

    @GetMapping("/api/faculty-buildings/{facultyId}")
    public List<BuildingDto> listBuildings(@PathVariable @Min(1) Long facultyId) {
        return service.listBuildingsByFaculty(facultyId);
    }

    // Базовая обработка ошибок валидации домена
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(IllegalArgumentException.class)
    public ApiError handleBadRequest(IllegalArgumentException ex) {
        return new ApiError("bad_request", ex.getMessage());
    }

    public record ApiError(String code, String message) { }
}
