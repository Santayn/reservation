package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.building.Building;
import org.santayn.reservation.repositories.BuildingRepository;
import org.santayn.reservation.web.dto.building.BuildingDto;
import org.santayn.reservation.web.dto.building.CreateBuildingRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * REST-контроллер для управления корпусами.
 * Эндпоинты:
 * GET    /api/buildings           — список
 * POST   /api/buildings           — создать (201)
 * DELETE /api/buildings/{id}      — удалить (204, идемпотентно)
 */
@RestController
@RequestMapping("/api/buildings")
@RequiredArgsConstructor
@Validated
public class BuildingRestController {

    private final BuildingRepository repo;

    @GetMapping
    public ResponseEntity<List<BuildingDto>> list() {
        List<BuildingDto> body = repo.findAll().stream()
                .sorted(Comparator.comparing(Building::getId, Comparator.nullsLast(Long::compareTo)))
                .map(b -> new BuildingDto(b.getId(), b.getName()))
                .toList();
        return ResponseEntity.ok(body);
    }

    @PostMapping
    public ResponseEntity<BuildingDto> create(@Valid @RequestBody CreateBuildingRequest request) {
        final String raw = request.name();
        final String name = raw == null ? "" : raw.trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Название корпуса не может быть пустым");
        }

        // Явная проверка на дубликат (дополнительно к уникальному индексу БД)
        if (repo.existsByNameIgnoreCase(name)) {
            throw new DuplicateNameException("Корпус с таким названием уже существует");
        }

        try {
            Building saved = repo.save(
                    Building.builder()
                            .name(name)
                            .adminUser(null) // при необходимости проставьте текущего пользователя
                            .build()
            );
            BuildingDto dto = new BuildingDto(saved.getId(), saved.getName());
            return ResponseEntity.status(HttpStatus.CREATED).body(dto);
        } catch (DataIntegrityViolationException ex) {
            // защита на случай гонки: уникальный индекс бросит исключение
            throw new DuplicateNameException("Корпус с таким названием уже существует");
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        if (repo.existsById(id)) {
            repo.deleteById(id);
        }
        return ResponseEntity.noContent().build();
    }

    // ===== локальные типы ошибок и маппинг кодов =====

    @ResponseStatus(HttpStatus.CONFLICT)
    @ExceptionHandler(DuplicateNameException.class)
    public ApiError handleDup(DuplicateNameException ex) {
        return new ApiError("duplicate_name", ex.getMessage());
    }

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(IllegalArgumentException.class)
    public ApiError handleBadReq(IllegalArgumentException ex) {
        return new ApiError("bad_request", ex.getMessage());
    }

    /**
     * Простой объект ошибки для JSON-ответа.
     */
    public record ApiError(String code, String message) { }

    /**
     * Исключение 409 CONFLICT при попытке создать дубликат корпуса.
     */
    public static class DuplicateNameException extends RuntimeException {
        public DuplicateNameException(String message) { super(message); }
    }

    /**
     * На случай, если вы не используете отдельный класс запроса, можно воспользоваться этим record’ом:
     */
    public record CreateRequestFallback(@NotBlank String name) { }
}
