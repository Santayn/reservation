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

        BuildingLayout layoutEntity = BuildingLayout.builder()
                .name(req.getName())
                .layoutJson(req.getLayoutJson())
                .createdAt(now)
                .updatedAt(now)
                .build();

        BuildingLayout savedLayout = layoutRepository.save(layoutEntity);

        Building building = buildingRepository.findById(req.getBuildingId())
                .orElseThrow(() -> new IllegalArgumentException("Building not found: " + req.getBuildingId()));

        BuildingLayoutLink link = linkRepository
                .findByBuilding_IdAndFloorNumber(req.getBuildingId(), req.getFloorNumber())
                .orElseGet(BuildingLayoutLink::new);

        link.setBuilding(building);
        link.setLayout(savedLayout);
        link.setFloorNumber(req.getFloorNumber());
        BuildingLayoutLink savedLink = linkRepository.save(link);

        List<ClassroomService.RoomCandidate> rooms = extractRoomsFromLayoutJson(req.getLayoutJson());
        classroomService.upsertRoomsForLayout(savedLayout.getId(), rooms);

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

        layout.setName(req.getName());
        layout.setLayoutJson(req.getLayoutJson());
        layout.setUpdatedAt(now);
        BuildingLayout savedLayout = layoutRepository.save(layout);

        Building building = buildingRepository.findById(req.getBuildingId())
                .orElseThrow(() -> new IllegalArgumentException("Building not found: " + req.getBuildingId()));

        // либо найдём текущую связку для этого (building,floor), либо создадим новую
        BuildingLayoutLink link = linkRepository
                .findByBuilding_IdAndFloorNumber(req.getBuildingId(), req.getFloorNumber())
                .orElseGet(BuildingLayoutLink::new);

        link.setBuilding(building);
        link.setLayout(savedLayout);
        link.setFloorNumber(req.getFloorNumber());
        BuildingLayoutLink savedLink = linkRepository.save(link);

        List<ClassroomService.RoomCandidate> rooms = extractRoomsFromLayoutJson(req.getLayoutJson());
        classroomService.upsertRoomsForLayout(savedLayout.getId(), rooms);

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
                Integer capacity = optInt(el.get("capacity")).orElse(0);
                if (!roomName.isBlank()) {
                    result.add(new ClassroomService.RoomCandidate(roomName, capacity));
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
}
