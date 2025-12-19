package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.FacultyService;
import org.santayn.reservation.web.dto.common.IdNameDto;
import org.santayn.reservation.web.dto.faculty.FacultyCreateRequest;
import org.santayn.reservation.web.dto.faculty.FacultyDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/faculties")
@RequiredArgsConstructor
public class FacultyRestController {

    private final FacultyService service;

    @PostMapping
    public ResponseEntity<FacultyDto> create(@Valid @RequestBody FacultyCreateRequest r) {
        return ResponseEntity.ok(service.create(r));
    }

    /**
     * Полный список факультетов (для админки/CRUD).
     */
    @GetMapping
    public ResponseEntity<List<FacultyDto>> list() {
        return ResponseEntity.ok(service.list());
    }

    /**
     * Лёгкий список для выпадающих меню: только id и name.
     * Пример: GET /api/faculties/options
     */
    @GetMapping("/options")
    public ResponseEntity<List<IdNameDto>> options() {
        List<IdNameDto> data = service.list().stream()
                .map(f -> new IdNameDto(f.id(), f.name()))
                .toList();
        return ResponseEntity.ok(data);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
