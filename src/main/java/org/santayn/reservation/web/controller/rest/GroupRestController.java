// org/santayn/reservation/web/controller/rest/GroupRestController.java
package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.GroupService;
import org.santayn.reservation.web.dto.group.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupRestController {
    private final GroupService service;

    @PostMapping
    public ResponseEntity<GroupDto> create(@Valid @RequestBody GroupCreateRequest r) {
        return ResponseEntity.ok(service.create(r));
    }

    @GetMapping
    public ResponseEntity<List<GroupDto>> list() {
        return ResponseEntity.ok(service.list());
    }
}
