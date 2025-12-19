package org.santayn.reservation.web.controller.rest;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.UtilizationService;
import org.santayn.reservation.web.dto.map.ClassroomLoadDto;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
public class MapRestController {

    private final UtilizationService utilizationService;

    /**
     * Пример запроса: GET /api/map/utilization?date=2025-10-06&slotId=1
     */
    @GetMapping("/utilization")
    public ResponseEntity<List<ClassroomLoadDto>> utilization(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam Long slotId
    ) {
        return ResponseEntity.ok(utilizationService.utilizationByDateAndSlot(date, slotId));
    }
}
