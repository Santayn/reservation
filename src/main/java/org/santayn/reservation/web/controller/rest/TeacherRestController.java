// org/santayn/reservation/web/controller/rest/TeacherRestController.java
package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.TeacherService;
import org.santayn.reservation.web.dto.teacher.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/teachers")
@RequiredArgsConstructor
public class TeacherRestController {
    private final TeacherService service;

    @PostMapping
    public ResponseEntity<TeacherDto> create(@Valid @RequestBody TeacherCreateRequest r) {
        return ResponseEntity.ok(service.create(r));
    }

    @GetMapping
    public ResponseEntity<List<TeacherDto>> list() {
        return ResponseEntity.ok(service.list());
    }
}
