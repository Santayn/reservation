// org/santayn/reservation/web/controller/rest/TeacherGroupRestController.java
package org.santayn.reservation.web.controller.rest;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.TeacherGroupService;
import org.santayn.reservation.web.dto.group.GroupDto;
import org.santayn.reservation.web.dto.teacher.TeacherGroupCreateRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/teacher-groups")
@RequiredArgsConstructor
public class TeacherGroupRestController {
    private final TeacherGroupService service;

    @PostMapping
    public ResponseEntity<Void> create(@RequestBody TeacherGroupCreateRequest r) {
        service.create(r);
        return ResponseEntity.ok().build();
    }

    // список групп выбранного преподавателя
    @GetMapping("/{teacherId}")
    public ResponseEntity<List<GroupDto>> list(@PathVariable Long teacherId) {
        return ResponseEntity.ok(service.listByTeacher(teacherId));
    }

    // удаление связи
    @DeleteMapping
    public ResponseEntity<Void> delete(@RequestParam Long teacherId,
                                       @RequestParam Integer groupId) {
        service.deleteLink(teacherId, groupId);
        return ResponseEntity.noContent().build();
    }
}
