// src/main/java/org/santayn/reservation/web/controller/rest/ClassroomsRestController.java
package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.ClassroomService;
import org.santayn.reservation.web.dto.classroom.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/classrooms")
@RequiredArgsConstructor
public class ClassroomsRestController {

    private final ClassroomService service;

    @GetMapping
    public ResponseEntity<List<ClassroomDto>> list() {
        return ResponseEntity.ok(service.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClassroomDto> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.get(id));
    }

    @PostMapping
    public ResponseEntity<ClassroomDto> create(@Valid @RequestBody ClassroomCreateRequest r) {
        return ResponseEntity.ok(service.create(r));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClassroomDto> update(@PathVariable Long id,
                                               @Valid @RequestBody ClassroomUpdateRequest r) {
        return ResponseEntity.ok(service.update(id, r));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Найти кабинет по имени или создать (чтобы фронт всегда имел id). */
    @PostMapping("/ensure")
    public ResponseEntity<ClassroomDto> ensure(@Valid @RequestBody ClassroomEnsureRequest r) {
        return ResponseEntity.ok(service.ensureByName(r));
    }
}
