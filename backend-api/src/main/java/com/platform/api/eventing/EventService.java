package com.platform.api.eventing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.api.logs.DeploymentLog;
import com.platform.api.logs.DeploymentLogRepository;
import com.platform.api.logs.LogSseService;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Properties;
import java.util.UUID;

@Slf4j
@Service
public class EventService {

    private final DeploymentLogRepository logRepository;
    private final LogSseService logSseService;
    private final ObjectMapper objectMapper;
    private final KafkaProducer<String, String> kafkaProducer;

    @Value("${app.kubernetes.enabled:true}")
    private boolean kubernetesEnabled;

    @Value("${app.eventing.default-topic:knative-demo}")
    private String defaultTopic;

    public EventService(DeploymentLogRepository logRepository,
                        LogSseService logSseService,
                        ObjectMapper objectMapper,
                        @Value("${app.kafka.bootstrap-servers:10.9.21.233:9093}") String bootstrapServers) {
        this.logRepository  = logRepository;
        this.logSseService  = logSseService;
        this.objectMapper   = objectMapper;

        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.ACKS_CONFIG, "1");
        this.kafkaProducer = new KafkaProducer<>(props);
    }

    public void publish(Map<String, Object> payload) {
        publish(payload, null);
    }

    public void publish(Map<String, Object> payload, String userId) {
        String eventType = payload.getOrDefault("type", "PLATFORM_EVENT").toString();
        String eventId   = UUID.randomUUID().toString();
        String appId     = payload.getOrDefault("appId", "").toString();
        // Utilise le topic fourni dans le payload, sinon le topic par défaut
        String topic     = payload.getOrDefault("topic", defaultTopic).toString();

        if (!kubernetesEnabled) {
            log.info("[MOCK] Would publish to Kafka topic={} type={} id={}", topic, eventType, eventId);
            saveEventLog(userId, appId, eventType, eventId, topic, true);
            return;
        }

        try {
            // Construit le CloudEvent comme JSON dans la value du message Kafka
            Map<String, Object> cloudEvent = Map.of(
                    "specversion", "1.0",
                    "type",        eventType,
                    "source",      "platform-backend",
                    "id",          eventId,
                    "datacontenttype", "application/json",
                    "data",        payload
            );
            String value = objectMapper.writeValueAsString(cloudEvent);

            ProducerRecord<String, String> record = new ProducerRecord<>(topic, eventId, value);
            // Headers CloudEvents standard pour que KafkaSource les reconnaisse
            record.headers().add("ce_specversion",     "1.0".getBytes());
            record.headers().add("ce_type",            eventType.getBytes());
            record.headers().add("ce_source",          "platform-backend".getBytes());
            record.headers().add("ce_id",              eventId.getBytes());
            record.headers().add("content-type",       "application/json".getBytes());

            kafkaProducer.send(record, (metadata, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish to Kafka topic={}: {}", topic, ex.getMessage());
                    saveEventLog(userId, appId, eventType, eventId, topic, false);
                } else {
                    log.info("Published to Kafka topic={} partition={} offset={} type={}",
                            topic, metadata.partition(), metadata.offset(), eventType);
                    saveEventLog(userId, appId, eventType, eventId, topic, true);
                }
            });

        } catch (Exception e) {
            log.error("Failed to publish CloudEvent: {}", e.getMessage());
            saveEventLog(userId, appId, eventType, eventId, topic, false);
        }
    }

    private void saveEventLog(String userId, String appId, String eventType,
                               String eventId, String topic, boolean success) {
        try {
            DeploymentLog entry = DeploymentLog.builder()
                    .userId(userId)
                    .appId(appId == null || appId.isBlank() ? null : appId)
                    .message("CloudEvent → topic: " + topic + " | type: " + eventType + " | id: " + eventId)
                    .type(success ? "EVENT_PUBLISHED" : "EVENT_FAILED")
                    .build();
            logRepository.save(entry);
            logSseService.push(entry);
        } catch (Exception e) {
            log.warn("Could not save event log: {}", e.getMessage());
        }
    }
}
