// src/main/java/org/santayn/reservation/web/controller/rest/TeacherScheduleRestController.java
package org.santayn.reservation.web.controller.rest;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.TeacherScheduleService;

import org.santayn.reservation.web.dto.lesson.LessonDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/teachers/me")
@RequiredArgsConstructor
public class TeacherScheduleRestController {

    private final TeacherScheduleService teacherScheduleService;

    @GetMapping("/schedule")
    public ResponseEntity<List<LessonDto>> mySchedule(Principal principal) {
        return ResponseEntity.ok(teacherScheduleService.mySchedule(principal));
    }
}
