// org/santayn/reservation/web/controller/rest/TeacherGroupRestController.java
package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.TeacherGroupService;
import org.santayn.reservation.web.dto.teacher.TeacherGroupCreateRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/teacher-groups")
@RequiredArgsConstructor
public class TeacherGroupRestController {
    private final TeacherGroupService service;

    @PostMapping
    public ResponseEntity<Void> create(@Valid @RequestBody TeacherGroupCreateRequest r) {
        service.create(r);
        return ResponseEntity.ok().build();
    }
}
