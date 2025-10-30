package org.santayn.reservation.web.dto.layout;

public class BuildingLayoutResponse {

    private Long id;
    private String name;
    private Long buildingId;
    private Integer floorNumber;
    private String layoutJson;

    public BuildingLayoutResponse() {
    }

    public BuildingLayoutResponse(Long id,
                                  String name,
                                  Long buildingId,
                                  Integer floorNumber,
                                  String layoutJson) {
        this.id = id;
        this.name = name;
        this.buildingId = buildingId;
        this.floorNumber = floorNumber;
        this.layoutJson = layoutJson;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public Long getBuildingId() {
        return buildingId;
    }

    public Integer getFloorNumber() {
        return floorNumber;
    }

    public String getLayoutJson() {
        return layoutJson;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setBuildingId(Long buildingId) {
        this.buildingId = buildingId;
    }

    public void setFloorNumber(Integer floorNumber) {
        this.floorNumber = floorNumber;
    }

    public void setLayoutJson(String layoutJson) {
        this.layoutJson = layoutJson;
    }
}
