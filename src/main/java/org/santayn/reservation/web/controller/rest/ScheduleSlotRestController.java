package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.ScheduleSlotService;
import org.santayn.reservation.web.dto.schedule.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequiredArgsConstructor
@RequestMapping(value = "/api/schedule/slots", produces = MediaType.APPLICATION_JSON_VALUE)
public class ScheduleSlotRestController {

    private final ScheduleSlotService service;

    /** Список слотов (отсортирован по startAt). */
    @GetMapping
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(ScheduleSlotService.toRespList(service.list()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        var slot = service.getOrThrow(id);
        return ResponseEntity.ok(ScheduleSlotService.toResp(slot));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@Valid @RequestBody ScheduleSlotCreateRequest req) {
        var created = service.create(req);
        return ResponseEntity
                .created(URI.create("/api/schedule/slots/" + created.getId()))
                .body(ScheduleSlotService.toResp(created));
    }

    @PostMapping(value = "/bulk", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> createBulk(@Valid @RequestBody ScheduleSlotBulkCreateRequest req) {
        var created = service.createBulk(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ScheduleSlotService.toRespList(created));
    }

    /** Генерация сетки («пара + перемена») */
    @PostMapping(value = "/generate", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> generate(@Valid @RequestBody ScheduleSlotGenerateRequest req) {
        var created = service.generate(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ScheduleSlotService.toRespList(created));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @Valid @RequestBody ScheduleSlotCreateRequest req) {
        var updated = service.update(id, req);
        return ResponseEntity.ok(ScheduleSlotService.toResp(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    // Локальные хендлеры ошибок
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> bad(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> conflict(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
    }
}
