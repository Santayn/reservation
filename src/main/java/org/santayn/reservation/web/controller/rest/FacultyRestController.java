// org/santayn/reservation/web/controller/rest/FacultyRestController.java
package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.FacultyService;
import org.santayn.reservation.web.dto.faculty.*;
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

    @GetMapping
    public ResponseEntity<List<FacultyDto>> list() {
        return ResponseEntity.ok(service.list());
    }
}
