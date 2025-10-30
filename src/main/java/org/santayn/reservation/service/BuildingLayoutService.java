package org.santayn.reservation.service;


import org.santayn.reservation.layout.BuildingLayout;
import org.santayn.reservation.repositories.BuildingLayoutRepository;
import org.santayn.reservation.web.dto.layout.BuildingLayoutCreateRequest;

import org.santayn.reservation.web.dto.layout.BuildingLayoutResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class BuildingLayoutService {

    private final BuildingLayoutRepository repository;

    public BuildingLayoutService(BuildingLayoutRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public BuildingLayoutResponse create(BuildingLayoutCreateRequest req) {
        Instant now = Instant.now();

        BuildingLayout entity = BuildingLayout.builder()
                .name(req.getName())
                .buildingId(req.getBuildingId())
                .floorNumber(req.getFloorNumber())
                .layoutJson(req.getLayoutJson())
                .createdAt(now)
                .updatedAt(now)
                .build();

        BuildingLayout saved = repository.save(entity);

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<BuildingLayoutResponse> findByBuilding(Long buildingId) {
        return repository.findAllByBuildingIdOrderByNameAsc(buildingId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public BuildingLayoutResponse getById(Long id) {
        BuildingLayout layout = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Layout not found"));
        return toResponse(layout);
    }

    private BuildingLayoutResponse toResponse(BuildingLayout bl) {
        return new BuildingLayoutResponse(
                bl.getId(),
                bl.getName(),
                bl.getBuildingId(),
                bl.getFloorNumber(),
                bl.getLayoutJson()
        );
    }
}
