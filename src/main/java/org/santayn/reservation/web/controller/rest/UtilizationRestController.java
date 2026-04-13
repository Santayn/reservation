package org.santayn.reservation.web.controller.rest;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.schedule.WeekParityType;
import org.santayn.reservation.service.AuthTeacherService;
import org.santayn.reservation.service.UtilizationService;
import org.santayn.reservation.web.dto.map.ClassroomLoadDto;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/utilization")
@RequiredArgsConstructor
public class UtilizationRestController {

    private final UtilizationService utilizationService;
    private final AuthTeacherService authTeacherService;

    /**
     * GET /api/utilization?date=2025-10-06&slotId=1
     */
    @GetMapping
    public ResponseEntity<List<ClassroomLoadDto>> utilization(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam Long slotId
    ) {
        return ResponseEntity.ok(utilizationService.utilizationByDateAndSlot(date, slotId));
    }

    @GetMapping("/rooms")
    public ResponseEntity<List<ClassroomLoadDto>> roomLoads(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam DayOfWeek dayOfWeek,
            @RequestParam(required = false) WeekParityType weekParityType,
            @RequestParam Long slotId,
            @RequestParam(required = false) Long buildingId,
            @RequestParam(required = false) Long facultyId,
            @RequestParam(required = false) Long specializationId,
            @RequestParam(required = false, defaultValue = "false") boolean myOnly
    ) {
        Long teacherId = myOnly ? authTeacherService.currentTeacherId() : null;
        return ResponseEntity.ok(utilizationService.roomLoads(
                date,
                dayOfWeek,
                weekParityType,
                slotId,
                buildingId,
                facultyId,
                specializationId,
                teacherId
        ));
    }
}
