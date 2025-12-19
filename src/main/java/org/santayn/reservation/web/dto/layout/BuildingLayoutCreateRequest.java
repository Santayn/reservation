package org.santayn.reservation.web.dto.layout;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class BuildingLayoutCreateRequest {

    @NotBlank
    private String name;

    @NotNull
    private Long buildingId;

    private Integer floorNumber;

    @NotBlank
    private String layoutJson;

    public BuildingLayoutCreateRequest() {
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
