package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.GroupService;
import org.santayn.reservation.web.dto.group.GroupCreateRequest;
import org.santayn.reservation.web.dto.group.GroupDto;
import org.santayn.reservation.web.dto.group.GroupUpdateRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupRestController {

    private final GroupService service;

    @GetMapping
    public ResponseEntity<List<GroupDto>> list() {
        return ResponseEntity.ok(service.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<GroupDto> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.get(id));
    }

    @PostMapping
    public ResponseEntity<GroupDto> create(@Valid @RequestBody GroupCreateRequest req) {
        GroupDto created = service.create(req);
        return ResponseEntity.created(URI.create("/api/groups/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<GroupDto> update(@PathVariable Long id,
                                           @Valid @RequestBody GroupUpdateRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
