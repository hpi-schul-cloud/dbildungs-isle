# Kafka

The Kafka image used in the project is `bitnami/kafka`.

The container exposes an external client on port 9094.

## Using a Kafka-client using docker

You can use the same image to create a container with an interactive shell:

`docker run -it --rm --network host bitnami/kafka:3.9.0 bash`

Inside this shell you can access the shell-scripts provided by Kafka.
Just make sure to include `--bootstrap-server localhost:9094` so the client points to the container from the `compose.yaml`.

### Examples

Create new topic:
`kafka-topics.sh --bootstrap-server localhost:9094 --create --if-not-exists --topic test_topic --partitions 1`

List topics:
`kafka-topics.sh --bootstrap-server localhost:9094 --list`

Listen to messages:
`kafka-console-consumer.sh --bootstrap-server localhost:9094 --topic test_topic`

Produce messages:
`kafka-console-producer.sh --bootstrap-server localhost:9094 --topic test_topic`
