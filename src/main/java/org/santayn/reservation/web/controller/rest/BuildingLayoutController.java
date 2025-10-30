package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import org.santayn.reservation.service.BuildingLayoutService;
import org.santayn.reservation.web.dto.layout.BuildingLayoutCreateRequest;
import org.santayn.reservation.web.dto.layout.BuildingLayoutResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/layouts")
public class BuildingLayoutController {

    private final BuildingLayoutService service;

    public BuildingLayoutController(BuildingLayoutService service) {
        this.service = service;
    }

    /**
     * Создать новую схему (только админ).
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public BuildingLayoutResponse createLayout(
            @Valid @RequestBody BuildingLayoutCreateRequest request
    ) {
        return service.create(request);
    }

    /**
     * [НОВОЕ] Получить все схемы здания без разделения на корпуса.
     * Это то, что теперь будет использовать фронт.
     *
     * Пример ответа:
     * [
     *   { "id":1, "name":"схема А", "buildingId":1, "floorNumber":1, "layoutJson":"{...}" },
     *   { "id":2, "name":"схема Б", "buildingId":1, "floorNumber":2, "layoutJson":"{...}" },
     *   { "id":3, "name":"тест 1", "buildingId":6, "floorNumber":null, "layoutJson":"{...}" }
     * ]
     */
    @GetMapping
    public List<BuildingLayoutResponse> listAllLayouts() {
        return service.findAllLayouts();
    }

    /**
     * СТАРАЯ РУЧКА. Оставляем для совместимости:
     * все схемы конкретного buildingId.
     * Фронт больше это не вызывает, но вдруг где-то в админке зовётся.
     */
    @GetMapping("/by-building/{buildingId}")
    public List<BuildingLayoutResponse> listByBuilding(@PathVariable Long buildingId) {
        return service.findByBuilding(buildingId);
    }

    /**
     * Получить конкретную схему по id.
     */
    @GetMapping("/{layoutId}")
    public BuildingLayoutResponse getLayout(@PathVariable Long layoutId) {
        return service.getById(layoutId);
    }
}
