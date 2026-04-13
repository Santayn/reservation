package org.santayn.reservation.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
 * BuildingLayout (layout_defs) — сама схема, не содержит buildingId/floorNumber.
 * BuildingLayoutLink (building_layouts) — связка (building_id, floor_number) -> layout_id.
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
     * Создать новую схему и привязать её к корпусу/этажу.
     */
    @Transactional
    public BuildingLayoutResponse create(BuildingLayoutCreateRequest req) {
        Instant now = Instant.now();

        Building building = buildingRepository.findById(req.getBuildingId())
                .orElseThrow(() -> new IllegalArgumentException("Building not found: " + req.getBuildingId()));

        if (linkRepository.existsByBuilding_IdAndFloorNumber(req.getBuildingId(), req.getFloorNumber())) {
            throw new IllegalStateException("Для этого корпуса и этажа уже есть схема. Загрузите её и отредактируйте.");
        }

        String layoutJson = syncRoomsAndClassroomIds(req.getBuildingId(), req.getLayoutJson());

        BuildingLayout layoutEntity = BuildingLayout.builder()
                .name(req.getName())
                .layoutJson(layoutJson)
                .createdAt(now)
                .updatedAt(now)
                .build();

        BuildingLayout savedLayout = layoutRepository.save(layoutEntity);

        BuildingLayoutLink link = new BuildingLayoutLink();

        link.setBuilding(building);
        link.setLayout(savedLayout);
        link.setFloorNumber(req.getFloorNumber());
        BuildingLayoutLink savedLink = linkRepository.save(link);

        return toResponse(savedLayout, savedLink);
    }

    /**
     * Обновить существующую схему (имя/чертёж) и при необходимости переставить линк на другой этаж/корпус.
     */
    @Transactional
    public BuildingLayoutResponse update(Long layoutId, BuildingLayoutCreateRequest req) {
        Instant now = Instant.now();

        BuildingLayout layout = layoutRepository.findById(layoutId)
                .orElseThrow(() -> new IllegalArgumentException("Layout not found: " + layoutId));

        Building building = buildingRepository.findById(req.getBuildingId())
                .orElseThrow(() -> new IllegalArgumentException("Building not found: " + req.getBuildingId()));

        BuildingLayoutLink link = resolveLinkForUpdate(layoutId, req.getBuildingId(), req.getFloorNumber());

        String layoutJson = syncRoomsAndClassroomIds(req.getBuildingId(), req.getLayoutJson());

        layout.setName(req.getName());
        layout.setLayoutJson(layoutJson);
        layout.setUpdatedAt(now);
        BuildingLayout savedLayout = layoutRepository.save(layout);

        link.setBuilding(building);
        link.setLayout(savedLayout);
        link.setFloorNumber(req.getFloorNumber());
        BuildingLayoutLink savedLink = linkRepository.save(link);

        return toResponse(savedLayout, savedLink);
    }

    /**
     * Удалить схему: удаляются все линкы на неё и сам layout.
     * Аудитории намеренно не трогаем (чтобы не сломать историю бронирований).
     */
    @Transactional
    public void delete(Long layoutId) {
        BuildingLayout layout = layoutRepository.findById(layoutId)
                .orElseThrow(() -> new IllegalArgumentException("Layout not found: " + layoutId));

        List<BuildingLayoutLink> links = linkRepository.findAllByLayout_Id(layoutId);
        for (BuildingLayoutLink l : links) {
            linkRepository.delete(l);
        }
        layoutRepository.delete(layout);
    }

    /**
     * Список схем для корпуса по возрастанию этажа.
     */
    @Transactional(readOnly = true)
    public List<BuildingLayoutResponse> findByBuilding(Long buildingId) {
        List<BuildingLayoutLink> links = linkRepository.findAllByBuilding_IdOrderByFloorNumberAsc(buildingId);
        return links.stream().map(link -> toResponse(link.getLayout(), link)).toList();
    }

    /**
     * Получить схему по layoutId (+ линк для buildingId/floorNumber, если есть).
     */
    @Transactional(readOnly = true)
    public BuildingLayoutResponse getById(Long layoutId) {
        BuildingLayout layout = layoutRepository.findById(layoutId)
                .orElseThrow(() -> new IllegalArgumentException("Layout not found: " + layoutId));

        Optional<BuildingLayoutLink> linkOpt = linkRepository.findFirstByLayout_IdOrderByFloorNumberAsc(layoutId);
        return toResponse(layout, linkOpt.orElse(null));
    }

    /**
     * Все связки по системе (для админки).
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
        return allLinks.stream().map(link -> toResponse(link.getLayout(), link)).toList();
    }

    /**
     * Алиас к findByBuilding.
     */
    @Transactional(readOnly = true)
    public List<BuildingLayoutResponse> listFloorsForBuilding(Long buildingId) {
        return findByBuilding(buildingId);
    }

    private BuildingLayoutLink resolveLinkForUpdate(Long layoutId, Long buildingId, Integer floorNumber) {
        List<BuildingLayoutLink> currentLinks = linkRepository.findAllByLayout_Id(layoutId);
        Optional<BuildingLayoutLink> targetLinkOpt =
                linkRepository.findByBuilding_IdAndFloorNumber(buildingId, floorNumber);

        BuildingLayoutLink link;
        if (targetLinkOpt.isPresent()) {
            BuildingLayoutLink targetLink = targetLinkOpt.get();
            Long targetLayoutId = targetLink.getLayout() != null ? targetLink.getLayout().getId() : null;
            if (!Objects.equals(targetLayoutId, layoutId)) {
                throw new IllegalStateException("Для этого корпуса и этажа уже есть другая схема.");
            }
            link = targetLink;
        } else {
            link = currentLinks.stream().findFirst().orElseGet(BuildingLayoutLink::new);
        }

        for (BuildingLayoutLink currentLink : currentLinks) {
            if (!sameEntity(currentLink, link)) {
                linkRepository.delete(currentLink);
            }
        }

        return link;
    }

    private boolean sameEntity(BuildingLayoutLink a, BuildingLayoutLink b) {
        if (a == b) return true;
        if (a == null || b == null) return false;
        return a.getId() != null && Objects.equals(a.getId(), b.getId());
    }

    private BuildingLayoutResponse toResponse(BuildingLayout layout, BuildingLayoutLink link) {
        Long buildingId = (link != null && link.getBuilding() != null) ? link.getBuilding().getId() : null;
        Integer floorNumber = (link != null) ? link.getFloorNumber() : null;

        return new BuildingLayoutResponse(
                layout.getId(),
                layout.getName(),
                buildingId,
                floorNumber,
                layout.getLayoutJson()
        );
    }

    private String syncRoomsAndClassroomIds(Long buildingId, String layoutJson) {
        List<ClassroomService.RoomCandidate> rooms = extractRoomsFromLayoutJson(layoutJson);
        Map<String, Long> classroomIdsByRoomKey = classroomService.upsertRoomsForLayout(buildingId, rooms);
        if (classroomIdsByRoomKey.isEmpty()) {
            return layoutJson;
        }
        return applyClassroomIdsToLayoutJson(layoutJson, classroomIdsByRoomKey);
    }

    private String applyClassroomIdsToLayoutJson(String layoutJson, Map<String, Long> classroomIdsByRoomKey) {
        if (layoutJson == null || layoutJson.isBlank()) return layoutJson;

        try {
            JsonNode root = objectMapper.readTree(layoutJson);
            JsonNode elements = root.get("elements");
            if (!(root instanceof ObjectNode) || elements == null || !elements.isArray()) {
                return layoutJson;
            }

            for (JsonNode el : elements) {
                if (!(el instanceof ObjectNode objectElement)) continue;
                String type = optText(el.get("type"));
                if (!"room".equalsIgnoreCase(type)) continue;

                String roomName = optText(el.get("roomName"));
                Long classroomId = classroomIdsByRoomKey.get(roomCandidateKey(el, roomName));
                if (classroomId != null) {
                    objectElement.put("classroomId", classroomId);
                }
            }

            return objectMapper.writeValueAsString(root);
        } catch (Exception ignored) {
            return layoutJson;
        }
    }

    private List<ClassroomService.RoomCandidate> extractRoomsFromLayoutJson(String layoutJson) {
        List<ClassroomService.RoomCandidate> result = new ArrayList<>();
        if (layoutJson == null || layoutJson.isBlank()) return result;

        try {
            JsonNode root = objectMapper.readTree(layoutJson);
            JsonNode elements = root.get("elements");
            if (elements == null || !elements.isArray()) return result;

            for (JsonNode el : elements) {
                String type = optText(el.get("type"));
                if (!"room".equalsIgnoreCase(type)) continue;

                String roomName = optText(el.get("roomName"));
                Long classroomId = optLong(el.get("classroomId")).orElse(null);
                Integer capacity = optInt(el.get("capacity")).orElse(0);
                if (!roomName.isBlank()) {
                    result.add(new ClassroomService.RoomCandidate(
                            roomCandidateKey(el, roomName),
                            classroomId,
                            roomName,
                            capacity
                    ));
                }
            }
        } catch (Exception ignored) {
            // не падаем из-за битого JSON
        }
        return result;
    }

    private String optText(JsonNode node) {
        return (node == null || node.isNull()) ? "" : node.asText("");
    }

    private Optional<Integer> optInt(JsonNode node) {
        if (node == null || node.isNull()) return Optional.empty();
        try {
            return Optional.of(node.asInt());
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private Optional<Long> optLong(JsonNode node) {
        if (node == null || node.isNull()) return Optional.empty();
        try {
            if (node.isNumber()) {
                return Optional.of(node.asLong());
            }

            String value = node.asText("").trim();
            if (value.isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(Long.parseLong(value));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private String roomCandidateKey(JsonNode el, String roomName) {
        String elementId = optText(el.get("id"));
        if (!elementId.isBlank()) {
            return "id:" + elementId;
        }
        return "name:" + roomName.trim().toLowerCase();
    }
}
