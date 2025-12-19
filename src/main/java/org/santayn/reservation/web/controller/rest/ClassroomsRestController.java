package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.ClassroomService;
import org.santayn.reservation.web.dto.classroom.ClassroomCreateRequest;
import org.santayn.reservation.web.dto.classroom.ClassroomDto;
import org.santayn.reservation.web.dto.classroom.ClassroomEnsureRequest;
import org.santayn.reservation.web.dto.classroom.ClassroomUpdateRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST-контроллер для аудиторий.
 *
 * ВАЖНО:
 * Модель не меняли, фронт не ломаем.
 * buildingId в DTO по-прежнему трактуется как "корпус",
 * но теперь по факту это может быть любая логическая группа.
 */
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
    public ResponseEntity<ClassroomDto> create(
            @Valid @RequestBody ClassroomCreateRequest r
    ) {
        return ResponseEntity.ok(service.create(r));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClassroomDto> update(
            @PathVariable Long id,
            @Valid @RequestBody ClassroomUpdateRequest r
    ) {
        return ResponseEntity.ok(service.update(id, r));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Найти или создать аудиторию по имени.
     * Это использует ensureByName(...) в сервисе.
     */
    @PostMapping("/ensure")
    public ResponseEntity<ClassroomDto> ensure(
            @Valid @RequestBody ClassroomEnsureRequest r
    ) {
        return ResponseEntity.ok(service.ensureByName(r));
    }
}
