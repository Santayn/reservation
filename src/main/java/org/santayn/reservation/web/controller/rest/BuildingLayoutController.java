package org.santayn.reservation.web.controller.rest;

import org.santayn.reservation.service.BuildingLayoutService;
import org.santayn.reservation.web.dto.layout.BuildingLayoutCreateRequest;
import org.santayn.reservation.web.dto.layout.BuildingLayoutResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/layouts")
public class BuildingLayoutController {

    private final BuildingLayoutService service;

    public BuildingLayoutController(BuildingLayoutService service) {
        this.service = service;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public BuildingLayoutResponse createLayout(@Valid @RequestBody BuildingLayoutCreateRequest request) {
        return service.create(request);
    }

    @GetMapping("/by-building/{buildingId}")
    public List<BuildingLayoutResponse> listByBuilding(@PathVariable Long buildingId) {
        return service.findByBuilding(buildingId);
    }

    @GetMapping("/{layoutId}")
    public BuildingLayoutResponse getLayout(@PathVariable Long layoutId) {
        return service.getById(layoutId);
    }
}
