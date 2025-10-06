package org.santayn.reservation.web.controller.rest;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.repositories.BuildingRepository;
import org.santayn.reservation.web.dto.building.BuildingDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/buildings")
@RequiredArgsConstructor
public class BuildingRestController {

    private final BuildingRepository repo;

    @GetMapping
    public ResponseEntity<List<BuildingDto>> list() {
        return ResponseEntity.ok(repo.findAll().stream()
                .map(b -> new BuildingDto(b.getId(), b.getName()))
                .toList());
    }
}
