package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import org.santayn.reservation.service.BuildingLayoutService;
import org.santayn.reservation.web.dto.layout.BuildingLayoutCreateRequest;
import org.santayn.reservation.web.dto.layout.BuildingLayoutResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST-контроллер для работы со схемами этажей зданий.
 *
 * Флоу для фронта теперь такой:
 *
 * 1) Пользователь выбирает корпус (Building).
 *    (у тебя уже должен быть эндпоинт типа GET /api/buildings)
 *
 * 2) Фронт загружает список этажей для этого корпуса:
 *    GET /api/layouts/by-building/{buildingId}
 *    → массив BuildingLayoutResponse:
 *       [
 *         { "id":12, "buildingId":5, "floorNumber":1, "name":"Этаж 1", "layoutJson":"{...}" },
 *         { "id":13, "buildingId":5, "floorNumber":2, "name":"Этаж 2", "layoutJson":"{...}" }
 *       ]
 *
 *    Фронт показывает список этажей (floorNumber) пользователю.
 *
 * 3) Когда пользователь выбрал конкретный этаж (layoutId),
 *    фронт подгружает схему этого этажа и рисует её:
 *    GET /api/layouts/{layoutId}
 *    → BuildingLayoutResponse (layoutJson внутри)
 *
 * 4) Админ в конструкторе плана создаёт/обновляет новую схему этажа:
 *    POST /api/layouts
 *    (нужна роль ADMIN)
 *
 *    В теле:
 *      {
 *        "buildingId": 5,
 *        "floorNumber": 2,
 *        "name": "Этаж 2 (обновлён)",
 *        "layoutJson": "{...}"
 *      }
 *
 *    После сохранения:
 *     - создаётся (или обновляется) схема BuildingLayout
 *     - создаётся/обновляется BuildingLayoutLink (buildingId+floorNumber -> эта схема)
 *     - создаются/обновляются аудитории в classrooms
 */
@RestController
@RequestMapping("/api/layouts")
public class BuildingLayoutController {

    private final BuildingLayoutService service;

    public BuildingLayoutController(BuildingLayoutService service) {
        this.service = service;
    }

    /**
     * Создать (или актуализировать) схему этажа.
     *
     * Требуется роль ADMIN.
     *
     * Возвращает BuildingLayoutResponse с полями:
     *   id          — id схемы (layoutId)
     *   buildingId  — id корпуса, куда мы эту схему подвязали
     *   floorNumber — номер этажа в этом корпусе
     *   name        — имя схемы
     *   layoutJson  — сам план
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public BuildingLayoutResponse createLayout(
            @Valid @RequestBody BuildingLayoutCreateRequest request
    ) {
        return service.create(request);
    }

    /**
     * Получить все этажи выбранного корпуса.
     *
     * Пример ответа:
     * [
     *   { "id":12, "buildingId":5, "floorNumber":1, "name":"Этаж 1", "layoutJson":"{...}" },
     *   { "id":13, "buildingId":5, "floorNumber":2, "name":"Этаж 2", "layoutJson":"{...}" }
     * ]
     *
     * Эти данные фронт использует, чтобы:
     *   - заполнить выпадающий список этажей
     *   - знать, какой layoutId грузить для выбранного этажа
     */
    @GetMapping("/by-building/{buildingId}")
    public List<BuildingLayoutResponse> listByBuilding(@PathVariable Long buildingId) {
        return service.findByBuilding(buildingId);
    }

    /**
     * Получить конкретную схему по её layoutId.
     *
     * В ответе будет layoutJson (чертёж), а также buildingId и floorNumber,
     * чтобы фронт понимал, к какому корпусу и какому этажу относится отображаемый план.
     */
    @GetMapping("/{layoutId}")
    public BuildingLayoutResponse getLayout(@PathVariable Long layoutId) {
        return service.getById(layoutId);
    }

    /**
     * Админский/отладочный эндпоинт:
     * вернуть ВСЕ этажи всех корпусов.
     *
     * Обычному пользователю это обычно не нужно,
     * но в админке может быть удобно.
     */
    @GetMapping
    public List<BuildingLayoutResponse> listAllLayouts() {
        return service.findAllLayouts();
    }
}
