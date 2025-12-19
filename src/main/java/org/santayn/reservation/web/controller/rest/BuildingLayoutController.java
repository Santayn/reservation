package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import java.util.List;
import org.santayn.reservation.service.BuildingLayoutService;
import org.santayn.reservation.web.dto.layout.BuildingLayoutCreateRequest;
import org.santayn.reservation.web.dto.layout.BuildingLayoutResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * REST-контроллер для работы со схемами этажей зданий.
 *
 * Поддерживает CRUD:
 *  - GET  /api/layouts/by-building/{buildingId} — список схем для корпуса
 *  - GET  /api/layouts/{layoutId}               — получить схему
 *  - GET  /api/layouts                          — все схемы (админ)
 *  - POST /api/layouts                          — создать схему (ADMIN)
 *  - PUT  /api/layouts/{layoutId}               — обновить схему (ADMIN)
 *  - DELETE /api/layouts/{layoutId}             — удалить схему (ADMIN)
 */
@RestController
@RequestMapping("/api/layouts")
public class BuildingLayoutController {

    private final BuildingLayoutService service;

    public BuildingLayoutController(BuildingLayoutService service) {
        this.service = service;
    }

    @GetMapping("/by-building/{buildingId}")
    public ResponseEntity<List<BuildingLayoutResponse>> listByBuilding(@PathVariable Long buildingId) {
        return ResponseEntity.ok(service.findByBuilding(buildingId));
    }

    @GetMapping("/{layoutId}")
    public ResponseEntity<BuildingLayoutResponse> getLayout(@PathVariable Long layoutId) {
        return ResponseEntity.ok(service.getById(layoutId));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<BuildingLayoutResponse>> listAllLayouts() {
        return ResponseEntity.ok(service.findAllLayouts());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BuildingLayoutResponse> createLayout(
            @Valid @RequestBody BuildingLayoutCreateRequest request) {
        BuildingLayoutResponse dto = service.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PutMapping("/{layoutId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BuildingLayoutResponse> updateLayout(
            @PathVariable Long layoutId,
            @Valid @RequestBody BuildingLayoutCreateRequest request) {
        BuildingLayoutResponse dto = service.update(layoutId, request);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/{layoutId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteLayout(@PathVariable Long layoutId) {
        service.delete(layoutId);
        return ResponseEntity.noContent().build();
    }
}
