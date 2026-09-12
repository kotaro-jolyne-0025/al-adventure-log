package com.dndadvlog.backend.mapper;

import com.dndadvlog.backend.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Optional;
import java.util.UUID;

@Mapper
public interface UserMapper {
    User findById(@Param("id") UUID id);

    User findByEmail(@Param("email") String email);

    void insert(User user);

    void update(User user);
}
