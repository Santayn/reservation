package org.santayn.reservation.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.layout.BuildingLayout;
import org.santayn.reservation.layout.BuildingLayoutLink;
import org.santayn.reservation.models.building.Building;
import org.santayn.reservation.repositories.BuildingLayoutLinkRepository;
import org.santayn.reservation.repositories.BuildingLayoutRepository;
import org.santayn.reservation.repositories.BuildingRepository;
import org.santayn.reservation.web.dto.layout.BuildingLayoutCreateRequest;
import org.santayn.reservation.web.dto.layout.BuildingLayoutResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Сервис управления схемами этажей (чертежами) и их привязкой к корпусам.
 *
 * Термины:
 *
 * 1) BuildingLayout (таблица layout_defs)
 *    - сама схема этажа: id, name, layoutJson, createdAt, updatedAt
 *    - НЕ хранит buildingId и floorNumber
 *
 * 2) BuildingLayoutLink (таблица building_layouts)
 *    - мост "какой этаж какого корпуса рисовать какой схемой":
 *      building_id  -> Building
 *      floor_number -> Integer
 *      layout_id    -> BuildingLayout
 *
 * 3) Создание схемы:
 *    - создаём запись в layout_defs (BuildingLayout)
 *    - создаём/обновляем запись в building_layouts (BuildingLayoutLink)
 *    - парсим layoutJson, достаём аудитории (type="room"), апсертим их через ClassroomService
 *
 * 4) DTO BuildingLayoutResponse, которое ждёт фронт, имеет поля:
 *      id, name, buildingId, floorNumber, layoutJson
 *    buildingId и floorNumber берём из BuildingLayoutLink.
 */
@Service
@RequiredArgsConstructor
public class BuildingLayoutService {

    private final BuildingLayoutRepository layoutRepository;
    private final BuildingLayoutLinkRepository linkRepository;
    private final BuildingRepository buildingRepository;
    private final ClassroomService classroomService;
    private final ObjectMapper objectMapper;

    /**
     * Создать (или переопределить) схему для конкретного корпуса и этажа.
     *
     * В BuildingLayoutCreateRequest приезжает:
     *  - buildingId    : ID корпуса
     *  - floorNumber   : номер этажа внутри этого корпуса
     *  - name          : человекочитаемое имя схемы ("Этаж 2 (крыло A)")
     *  - layoutJson    : JSON вида {"elements":[...]}
     *
     * Что делаем:
     *  1. Создаём новый BuildingLayout (layout_defs).
     *  2. В building_layouts (BuildingLayoutLink) либо создаём новую запись,
     *     либо обновляем существующую (если такой этаж уже есть в этом корпусе),
     *     чтобы она ссылалась на только что созданный layout.
     *  3. Из layoutJson достаём аудитории и апсертим их через ClassroomService.
     *  4. Возвращаем DTO для фронта.
     */
    @Transactional
    public BuildingLayoutResponse create(BuildingLayoutCreateRequest req) {

        Instant now = Instant.now();

        // (1) создаём сам чертёж (layout_defs)
        BuildingLayout layoutEntity = BuildingLayout.builder()
                .name(req.getName())
                .layoutJson(req.getLayoutJson())
                .createdAt(now)
                .updatedAt(now)
                .build();

        BuildingLayout savedLayout = layoutRepository.save(layoutEntity);

        // (2) проверяем, что корпус существует
        Building building = buildingRepository.findById(req.getBuildingId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Building not found: " + req.getBuildingId()
                ));

        // (3) линк на этаж:
        // пытаемся найти запись для (buildingId + floorNumber),
        // если есть — переиспользуем, просто переназначаем ей новый layout
        BuildingLayoutLink link = linkRepository
                .findByBuilding_IdAndFloorNumber(req.getBuildingId(), req.getFloorNumber())
                .orElseGet(BuildingLayoutLink::new);

        link.setBuilding(building);
        link.setLayout(savedLayout);
        link.setFloorNumber(req.getFloorNumber());

        BuildingLayoutLink savedLink = linkRepository.save(link);

        // (4) апсертим аудитории из схемы
        List<ClassroomService.RoomCandidate> extractedRooms =
                extractRoomsFromLayoutJson(req.getLayoutJson());

        classroomService.upsertRoomsForLayout(
                savedLayout.getId(),
                extractedRooms
        );

        // (5) собираем DTO для фронта
        return toResponse(savedLayout, savedLink);
    }

    /**
     * Вернуть список этажей (схем) по одному зданию.
     *
     * Это основной эндпоинт для фронта после выбора корпуса:
     * он покажет пользователю какие этажи есть и их названия.
     *
     * Возвращаем список BuildingLayoutResponse,
     * отсортированный по floorNumber.
     */
    @Transactional(readOnly = true)
    public List<BuildingLayoutResponse> findByBuilding(Long buildingId) {

        List<BuildingLayoutLink> links =
                linkRepository.findAllByBuilding_IdOrderByFloorNumberAsc(buildingId);

        return links.stream()
                .map(link -> toResponse(link.getLayout(), link))
                .toList();
    }

    /**
     * Вернуть одну конкретную схему по ID схемы (layoutId).
     *
     * BuildingLayout сам по себе не знает, к какому корпусу/этажу он привязан,
     * поэтому мы дополнительно вытягиваем первую подходящую связку BuildingLayoutLink.
     */
    @Transactional(readOnly = true)
    public BuildingLayoutResponse getById(Long layoutId) {

        BuildingLayout layout = layoutRepository.findById(layoutId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Layout not found: " + layoutId
                ));

        Optional<BuildingLayoutLink> linkOpt =
                linkRepository.findFirstByLayout_IdOrderByFloorNumberAsc(layoutId);

        BuildingLayoutLink link = linkOpt.orElse(null);

        return toResponse(layout, link);
    }

    /**
     * Админский обзор: вернуть все связки "корпус/этаж -> схема".
     *
     * Удобно для панели админа.
     * Сортируем по buildingId, потом по floorNumber, потом по layoutId.
     */
    @Transactional(readOnly = true)
    public List<BuildingLayoutResponse> findAllLayouts() {

        List<BuildingLayoutLink> allLinks = linkRepository.findAll();

        allLinks.sort(
                Comparator
                        .comparing((BuildingLayoutLink l) -> l.getBuilding().getId())
                        .thenComparing(BuildingLayoutLink::getFloorNumber)
                        .thenComparing(l -> l.getLayout().getId())
        );

        return allLinks.stream()
                .map(link -> toResponse(link.getLayout(), link))
                .toList();
    }

    /**
     * То же самое, что findByBuilding, просто с другим названием.
     * Можно использовать в сервисном коде, если по смыслу читается как
     * "дай список этажей этого здания".
     */
    @Transactional(readOnly = true)
    public List<BuildingLayoutResponse> listFloorsForBuilding(Long buildingId) {

        List<BuildingLayoutLink> links =
                linkRepository.findAllByBuilding_IdOrderByFloorNumberAsc(buildingId);

        return links.stream()
                .map(link -> toResponse(link.getLayout(), link))
                .toList();
    }

    /**
     * Собираем DTO для фронта.
     *
     * Фронту нужен формат:
     * {
     *   "id": <layoutId>,
     *   "name": "...",
     *   "buildingId": <или null>,
     *   "floorNumber": <или null>,
     *   "layoutJson": "{...}"
     * }
     *
     * Тут:
     *  - layout (BuildingLayout) даёт id/name/layoutJson
     *  - link (BuildingLayoutLink) даёт buildingId/floorNumber
     */
    private BuildingLayoutResponse toResponse(BuildingLayout layout, BuildingLayoutLink link) {

        Long buildingId = (link != null && link.getBuilding() != null)
                ? link.getBuilding().getId()
                : null;

        Integer floorNumber = (link != null)
                ? link.getFloorNumber()
                : null;

        return new BuildingLayoutResponse(
                layout.getId(),
                layout.getName(),
                buildingId,
                floorNumber,
                layout.getLayoutJson()
        );
    }

    /**
     * Разбор layoutJson → список аудиторий (комнат).
     *
     * Формат layoutJson, который приходит с фронта:
     *
     * {
     *   "elements": [
     *     {
     *       "type": "room",
     *       "roomName": "Ауд. 101",
     *       "capacity": 30
     *     },
     *     {
     *       "type": "wall",
     *       ...
     *     }
     *   ]
     * }
     *
     * Мы берём только элементы type="room".
     * Для каждой комнаты готовим RoomCandidate(name, capacity),
     * чтобы потом ClassroomService.upsertRoomsForLayout(...) обновил таблицу classrooms.
     */
    private List<ClassroomService.RoomCandidate> extractRoomsFromLayoutJson(String layoutJson) {
        List<ClassroomService.RoomCandidate> result = new ArrayList<>();

        if (layoutJson == null || layoutJson.isBlank()) {
            return result;
        }

        try {
            JsonNode root = objectMapper.readTree(layoutJson);
            JsonNode elements = root.get("elements");
            if (elements == null || !elements.isArray()) {
                return result;
            }

            for (JsonNode el : elements) {
                String type = optText(el.get("type"));
                if (!"room".equalsIgnoreCase(type)) {
                    continue;
                }

                String roomName = optText(el.get("roomName"));
                Integer capacity = optInt(el.get("capacity")).orElse(0);

                if (!roomName.isBlank()) {
                    result.add(new ClassroomService.RoomCandidate(roomName, capacity));
                }
            }
        } catch (Exception ignored) {
            // Битый layoutJson не должен ронять сохранение схемы.
            // В худшем случае просто не создадим аудитории.
        }

        return result;
    }

    /**
     * Безопасно прочитать строку из JsonNode (вернёт "" если null).
     */
    private String optText(JsonNode node) {
        return (node == null || node.isNull()) ? "" : node.asText("");
    }

    /**
     * Безопасно прочитать целое из JsonNode.
     */
    private Optional<Integer> optInt(JsonNode node) {
        if (node == null || node.isNull()) {
            return Optional.empty();
        }
        try {
            return Optional.of(node.asInt());
        } catch (Exception ex) {
            return Optional.empty();
        }
    }
}
