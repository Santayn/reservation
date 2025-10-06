package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.specialization.Specialization;
import org.santayn.reservation.repositories.SpecializationRepository;
import org.santayn.reservation.web.dto.specialization.SpecializationCreateRequest;
import org.santayn.reservation.web.dto.specialization.SpecializationDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/specializations")
@RequiredArgsConstructor
public class SpecializationRestController {

    private final SpecializationRepository repo;

    @PostMapping
    public ResponseEntity<SpecializationDto> create(@Valid @RequestBody SpecializationCreateRequest r) {
        Specialization s = repo.save(Specialization.builder().name(r.name()).build());
        return ResponseEntity.ok(new SpecializationDto(s.getId(), s.getName()));
    }

    @GetMapping
    public ResponseEntity<List<SpecializationDto>> list() {
        return ResponseEntity.ok(repo.findAll().stream()
                .map(s -> new SpecializationDto(s.getId(), s.getName()))
                .toList());
    }
}
